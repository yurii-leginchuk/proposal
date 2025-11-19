const cheerio = require('cheerio');

/**
 * Оновлює текстовий контент HTML без зміни стилів
 * @param {string} html - Початковий HTML
 * @param {Array} textEdits - Масив об'єктів { selector, text, value } для тексту та { selector, value } для input/select
 * @returns {string} - Оновлений HTML
 */
function updateTextContent(html, textEdits) {
  if (!textEdits || textEdits.length === 0) {
    return html;
  }

  const $ = cheerio.load(html, {
    decodeEntities: false,
  });

  textEdits.forEach(edit => {
    const { selector, text, value, type, dataId, html, hasChildren } = edit;

    if (!selector) return;

    // Спробувати знайти елемент за data-edit-id якщо є
    let $element;
    if (dataId) {
      $element = $(`[data-edit-id="${dataId}"]`);
    }
    
    // Якщо не знайдено за data-id, використати селектор
    if (!$element || $element.length === 0) {
      $element = $(selector);
    }
    
    if ($element.length === 0) return;

    if (type === 'input' || type === 'select' || type === 'textarea') {
      // Оновлення значення для input, select, textarea
      if (value !== undefined) {
        if (type === 'select') {
          // Оновити опції якщо вони надані
          if (edit.options && Array.isArray(edit.options)) {
            $element.empty();
            edit.options.forEach(opt => {
              const $option = $('<option>').attr('value', opt.value).text(opt.text);
              if (opt.selected || opt.value === value) {
                $option.prop('selected', true);
              }
              $element.append($option);
            });
            // Встановити значення після додавання опцій
            if (value !== undefined) {
              $element.val(value);
            }
          } else {
            // Просто вибрати значення
            $element.find('option').each(function() {
              if ($(this).val() === value) {
                $(this).prop('selected', true);
              } else {
                $(this).prop('selected', false);
              }
            });
          }
        } else {
          $element.val(value);
          // Для input type="text" також оновити атрибут value
          if (type === 'input') {
            $element.attr('value', value);
          }
        }
      }
    } else if (type === 'list') {
      // Оновлення списку
      if (edit.items && Array.isArray(edit.items)) {
        $element.empty();
        edit.items.forEach(item => {
          const $li = $('<li>');
          // Якщо item - об'єкт з html, використовуємо innerHTML
          if (typeof item === 'object' && item.html) {
            $li.html(item.html);
          } else {
            // Інакше використовуємо текст
            const text = typeof item === 'string' ? item : (item.text || '');
            $li.text(text);
          }
          $element.append($li);
        });
      }
    } else if (type === 'image') {
      // Оновлення зображення
      if (edit.src !== undefined) {
        $element.attr('src', edit.src);
      }
      if (edit.alt !== undefined) {
        $element.attr('alt', edit.alt);
      }
      if (edit.title !== undefined) {
        if (edit.title) {
          $element.attr('title', edit.title);
        } else {
          $element.removeAttr('title');
        }
      }
      if (edit.width !== undefined) {
        if (edit.width) {
          $element.attr('width', edit.width);
        } else {
          $element.removeAttr('width');
        }
      }
      if (edit.height !== undefined) {
        if (edit.height) {
          $element.attr('height', edit.height);
        } else {
          $element.removeAttr('height');
        }
      }
      // Зберегти стилі та класи якщо вони були
      if (edit.styles !== undefined && edit.styles) {
        $element.attr('style', edit.styles);
      }
      if (edit.className !== undefined && edit.className) {
        $element.attr('class', edit.className);
      }
    } else if (type === 'text') {
      // Оновлення текстового контенту
      // Перевіряємо чи є HTML для збереження структури
      // Важливо: перевіряємо і html, і hasChildren, щоб правильно обробити
      if (html !== undefined && html !== null && (hasChildren === true || html.includes('<'))) {
        // Використовуємо HTML для збереження структури
        console.log('Оновлення HTML для елемента:', selector, 'HTML length:', html ? html.length : 0);
        $element.html(html);
      } else if (text !== undefined && text !== null) {
        console.log('Оновлення тексту для елемента:', selector, 'Text:', text);
        // Зберегти HTML структуру, але оновити текстовий контент
        const htmlContent = $element.html();
        const hasHtmlContent = htmlContent && htmlContent.trim().length > 0 && 
                               (htmlContent.includes('<') || htmlContent.length > 0);
        
        // Якщо елемент містить тільки текст без дочірніх елементів
        if (!$element.children().length && !hasHtmlContent) {
          $element.text(text);
        } else {
          // Якщо є дочірні елементи, замінити тільки прямі текстові вузли
          $element.contents().each(function() {
            if (this.type === 'text' && this.data) {
              $(this).replaceWith(text);
              return false; // Зупинити після першого заміщення
            }
          });
          
          // Якщо текст не був знайдений серед дочірніх, додати його
          if ($element.text().trim() === '') {
            $element.prepend(text);
          }
        }
      } else {
        console.warn('Немає тексту або HTML для оновлення елемента:', selector, edit);
      }
      
      // Оновити спеціальні атрибути для inline елементів
      if (edit.href !== undefined && edit.tagName === 'a') {
        $element.attr('href', edit.href);
      }
      
      if (edit.title !== undefined && edit.tagName === 'abbr') {
        $element.attr('title', edit.title);
      }
      
      if (edit.datetime !== undefined && edit.tagName === 'time') {
        $element.attr('datetime', edit.datetime);
      }
      
      if (edit.dir !== undefined && edit.tagName === 'bdo') {
        $element.attr('dir', edit.dir);
      }
      
      // Зберегти стилі та класи якщо вони були
      if (edit.styles !== undefined && edit.styles) {
        $element.attr('style', edit.styles);
      }
      
      if (edit.className !== undefined && edit.className) {
        $element.attr('class', edit.className);
      }
    }
  });

  return $.html();
}

/**
 * Парсить HTML і повертає структуру для редагування
 * @param {string} html - HTML контент
 * @returns {Object} - Структура з елементами для редагування
 */
function parseHTML(html) {
  const $ = cheerio.load(html, {
    decodeEntities: false,
  });

  const editableElements = [];

  // Знайти всі елементи з текстом
  $('p, h1, h2, h3, h4, h5, h6, span, div, td, th, li, label').each(function() {
    const $el = $(this);
    const text = $el.text().trim();
    
    if (text && $el.children().length === 0) {
      editableElements.push({
        selector: getSelector($el),
        text: text,
        type: 'text',
      });
    }
  });

  // Знайти всі input, select, textarea
  $('input, select, textarea').each(function() {
    const $el = $(this);
    const tagName = $el.prop('tagName').toLowerCase();
    
    editableElements.push({
      selector: getSelector($el),
      value: tagName === 'select' ? $el.find('option:selected').val() : $el.val(),
      type: tagName,
      name: $el.attr('name') || '',
      label: $el.attr('label') || $el.closest('label').text().trim() || '',
    });
  });

  return editableElements;
}

/**
 * Генерує CSS селектор для елемента
 */
function getSelector($el) {
  let selector = $el.prop('tagName').toLowerCase();
  
  if ($el.attr('id')) {
    selector = `#${$el.attr('id')}`;
  } else if ($el.attr('class')) {
    const classes = $el.attr('class').split(' ').filter(c => c).join('.');
    if (classes) {
      selector = `.${classes}`;
    }
  }
  
  // Додати індекс для унікальності
  const index = $el.prevAll(selector).length;
  if (index > 0) {
    selector += `:nth-of-type(${index + 1})`;
  }
  
  return selector;
}

module.exports = {
  updateTextContent,
  parseHTML,
};

