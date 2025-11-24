// Global variables
let screens = [];
let clients = [];
let templates = [];
let currentClient = null; // null = default screens, otherwise client ID
let currentTemplate = null; // null = default screens, otherwise template ID
let currentScreen = null;
let currentEditingElement = null;
let elementDataMap = new Map(); // Stores element data for editing
let pendingChanges = {}; // Unsaved changes
let currentMode = 'default'; // 'default', 'templates', or 'clients'
let editingScreenId = null; // ID of screen being edited in modal
let editingClientId = null; // ID of client being edited
let editingTemplateId = null; // ID of template being edited
let shouldImportDefaultScreens = false; // Flag for importing default screens when creating client


function expand() {
    const main = document.querySelector('.main-content');
    const btn = document.querySelector('#expand-layout-btn');

    if (!main || !btn) return;


    const isExpanded = main.classList.toggle('expanded');
    btn.querySelector('span').textContent = isExpanded ? 'Collapse' : 'Expand';
}

function collapse() {
    const main = document.querySelector('.main-content');
    const btn = document.querySelector('#expand-layout-btn');

    if (!main || !btn) return;
    main.classList.remove('expanded');
    btn.querySelector('span').textContent =  'Expand';
}


// Global Loader Functions
function showLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'flex';
    }
}

function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Router functions
function navigateTo(path) {
    window.location.hash = path;
    handleRoute();
}

function handleRoute() {
    const hash = window.location.hash.slice(1) || '/screens';
    const parts = hash.split('/');
    
    if (parts[1] === 'clients') {
        currentMode = 'clients';
        currentClient = null;
        currentTemplate = null;
        updateUI();
        loadClients();
    } else if (parts[1] === 'client' && parts[2]) {
        const clientId = parts[2];
        loadClientScreens(clientId);
    } else if (parts[1] === 'templates') {
        currentMode = 'templates';
        currentClient = null;
        currentTemplate = null;
        updateUI();
        loadTemplates();
    } else if (parts[1] === 'template' && parts[2]) {
        const templateId = parts[2];
        loadTemplateScreens(templateId);
    } else if (parts[1] === 'screens' || hash === '/') {
        currentMode = 'default';
        currentClient = null;
        currentTemplate = null;
        updateUI();
        loadScreens();
    }
}

// Функція для форматування HTML
function formatHTML(html) {
    if (!html || !html.trim()) return html;
    
    // Видалити зайві пробіли та переноси рядків
    let formatted = html.trim().replace(/\s+/g, ' ').trim();
    
    // Розділити на теги та текст
    const parts = [];
    let currentPos = 0;
    const regex = /<[^>]+>/g;
    let match;
    
    while ((match = regex.exec(formatted)) !== null) {
        // Додати текст перед тегом
        if (match.index > currentPos) {
            const text = formatted.substring(currentPos, match.index).trim();
            if (text) {
                parts.push({ type: 'text', content: text });
            }
        }
        
        // Додати тег
        parts.push({ type: 'tag', content: match[0] });
        currentPos = match.index + match[0].length;
    }
    
    // Додати залишковий текст
    if (currentPos < formatted.length) {
        const text = formatted.substring(currentPos).trim();
        if (text) {
            parts.push({ type: 'text', content: text });
        }
    }
    
    if (parts.length === 0) return formatted;
    
    // Відформатувати з правильними відступами
    let result = [];
    let indent = 0;
    const indentSize = 2;
    const blockTags = ['div', 'section', 'article', 'header', 'footer', 'nav', 'main', 'ul', 'ol', 'li', 'dl', 'dt', 'dd'];
    const inlineTags = ['span', 'strong', 'em', 'b', 'i', 'a', 'code', 'mark', 'small', 'sup', 'sub', 'abbr', 'time'];
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (part.type === 'tag') {
            const tag = part.content;
            const isClosing = tag.startsWith('</');
            const isSelfClosing = tag.endsWith('/>') || 
                                 ['img', 'br', 'hr', 'input', 'meta', 'link'].some(t => 
                                     tag.match(new RegExp(`<${t}[\\s/>]`, 'i'))
                                 );
            
            // Отримати назву тега
            const tagMatch = tag.match(/<\/?(\w+)/);
            const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
            const isBlock = blockTags.includes(tagName);
            const isInline = inlineTags.includes(tagName);
            // h1-h6, p - це блочні теги, але текст всередині на окремому рядку
            const isHeadingOrParagraph = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tagName);
            
            if (isClosing) {
                indent--;
            }
            
            const indented = ' '.repeat(Math.max(0, indent * indentSize)) + tag;
            result.push(indented);
            
            // Збільшити відступ для блочних тегів
            if (!isClosing && !isSelfClosing && (isBlock || isHeadingOrParagraph)) {
                indent++;
            }
        } else {
            // Текст
            const text = part.content.trim();
            if (!text) continue;
            
            const prevPart = i > 0 ? parts[i - 1] : null;
            const nextPart = i < parts.length - 1 ? parts[i + 1] : null;
            
            // Перевірити, чи це текст всередині одного тега
            if (prevPart && prevPart.type === 'tag' && nextPart && nextPart.type === 'tag') {
                const prevTag = prevPart.content;
                const nextTag = nextPart.content;
                const prevTagMatch = prevTag.match(/<\/?(\w+)/);
                const nextTagMatch = nextTag.match(/<\/?(\w+)/);
                
                // Якщо це закриваючий тег для того самого елемента
                if (prevTagMatch && nextTagMatch && 
                    !prevTag.startsWith('</') && nextTag.startsWith('</') &&
                    prevTagMatch[1].toLowerCase() === nextTagMatch[1].toLowerCase()) {
                    // Текст всередині тега - додати на окремий рядок з відступом
                    const indented = ' '.repeat(Math.max(0, indent * indentSize)) + text;
                    result.push(indented);
                } else {
                    // Текст між різними тегами
                    const indented = ' '.repeat(Math.max(0, indent * indentSize)) + text;
                    result.push(indented);
                }
            } else {
                // Текст на початку або в кінці
                const indented = ' '.repeat(Math.max(0, indent * indentSize)) + text;
                result.push(indented);
            }
        }
    }
    
    return result.join('\n');
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadClients();
    loadTemplates(); // Load templates on init
    // Handle initial route
    handleRoute();
    // Listen for hash changes
    window.addEventListener('hashchange', handleRoute);
});

// Switch to clients view
function goToClients() {
    navigateTo('/clients');
}

// Switch to templates view
function goToTemplates() {
    navigateTo('/templates');
}

// Switch to default screens
function goToDefaultScreens() {
    navigateTo('/screens');
}

// Switch mode (for backward compatibility)
function switchMode(mode) {
    if (mode === 'default') {
        navigateTo('/screens');
    } else {
        navigateTo('/clients');
    }
}

// Update UI based on current context
function updateUI() {
    const clientsContent = document.getElementById('clients-content');
    const templatesContent = document.getElementById('templates-content');
    const screensContent = document.getElementById('screens-content');
    const backBtn = document.getElementById('back-to-clients-btn');
    const contextTitle = document.getElementById('context-title');
    const contextSubtitle = document.getElementById('context-subtitle');
    const currentContext = document.getElementById('current-context');
    const currentScreenName = document.getElementById('current-screen-name');
    
    // Navigation menu items
    const navDefaultScreens = document.getElementById('nav-default-screens');
    const navTemplates = document.getElementById('nav-templates');
    const navClients = document.getElementById('nav-clients');
    
    // Clear current screen when switching context
    if (currentScreen && (
        (currentMode === 'clients') || 
        (currentMode === 'templates') ||
        (currentClient && currentScreen.clientId !== currentClient) ||
        (currentTemplate && currentScreen.templateId !== currentTemplate) ||
        (!currentClient && !currentTemplate && currentScreen.isDefault === false)
    )) {
        currentScreen = null;
        if (currentScreenName) currentScreenName.textContent = '';
        showPreview();
    }
    
    if (currentMode === 'clients') {
        // Show clients list
        clientsContent.style.display = 'block';
        templatesContent.style.display = 'none';
        screensContent.style.display = 'none';
        backBtn.style.display = 'none';
        contextTitle.textContent = 'All Clients';
        contextSubtitle.textContent = 'Manage your clients and their screens';
        if (currentContext) currentContext.textContent = 'Clients';
        
        // Update nav items
        if (navDefaultScreens) navDefaultScreens.classList.remove('active');
        if (navTemplates) navTemplates.classList.remove('active');
        if (navClients) navClients.classList.add('active');
    } else if (currentMode === 'templates') {
        // Show templates list
        clientsContent.style.display = 'none';
        templatesContent.style.display = 'block';
        screensContent.style.display = 'none';
        backBtn.style.display = 'none';
        contextTitle.textContent = 'Templates Library';
        contextSubtitle.textContent = 'Manage your proposal templates';
        if (currentContext) currentContext.textContent = 'Templates';
        
        // Update nav items
        if (navDefaultScreens) navDefaultScreens.classList.remove('active');
        if (navTemplates) navTemplates.classList.add('active');
        if (navClients) navClients.classList.remove('active');
    } else if (currentClient) {
        // Show client screens
        clientsContent.style.display = 'none';
        templatesContent.style.display = 'none';
        screensContent.style.display = 'block';
        
        const client = clients.find(c => c._id === currentClient);
        const clientName = client ? client.name : 'Client';
        backBtn.style.display = 'flex';
        backBtn.onclick = () => goToClients();
        contextTitle.textContent = `${clientName} Screens`;
        contextSubtitle.textContent = `Manage screens for ${clientName}`;
        if (currentContext) currentContext.textContent = clientName;
        
        // Update nav items
        if (navDefaultScreens) navDefaultScreens.classList.remove('active');
        if (navTemplates) navTemplates.classList.remove('active');
        if (navClients) navClients.classList.add('active');
    } else if (currentTemplate) {
        // Show template screens
        clientsContent.style.display = 'none';
        templatesContent.style.display = 'none';
        screensContent.style.display = 'block';
        
        const template = templates.find(t => t._id === currentTemplate);
        const templateName = template ? template.name : 'Template';
        backBtn.style.display = 'flex';
        backBtn.onclick = () => goToTemplates();
        contextTitle.textContent = `${templateName} Screens`;
        contextSubtitle.textContent = `Manage screens for ${templateName}`;
        if (currentContext) currentContext.textContent = templateName;
        
        // Update nav items
        if (navDefaultScreens) navDefaultScreens.classList.remove('active');
        if (navTemplates) navTemplates.classList.add('active');
        if (navClients) navClients.classList.remove('active');
    } else {
        // Show default screens
        clientsContent.style.display = 'none';
        templatesContent.style.display = 'none';
        screensContent.style.display = 'block';
        backBtn.style.display = 'none';
        contextTitle.textContent = 'Screens Library';
        contextSubtitle.textContent = 'Manage your proposal screens library';
        if (currentContext) currentContext.textContent = 'Screens Library';
        
        // Update nav items
        if (navDefaultScreens) navDefaultScreens.classList.add('active');
        if (navTemplates) navTemplates.classList.remove('active');
        if (navClients) navClients.classList.remove('active');
    }
}

// Load clients
async function loadClients() {
    showLoader();
    try {
        const response = await fetch('/api/clients');
        clients = await response.json();
        renderClients();
    } catch (error) {
        console.error('Error loading clients:', error);
        alert('Error loading clients');
    } finally {
        hideLoader();
    }
}

// Render clients
function renderClients() {
    const clientsList = document.getElementById('clients-list');
    const emptyClients = document.getElementById('empty-clients');
    if (!clientsList) return;
    
    clientsList.innerHTML = '';

    if (clients.length === 0) {
        emptyClients.style.display = 'block';
        return;
    }
    
    emptyClients.style.display = 'none';

    clients.forEach(client => {
        const li = document.createElement('li');
        li.className = 'client-item';
        li.dataset.clientId = client._id;
        li.innerHTML = `
            <div class="client-header">${client.name}</div>
            ${client.email ? `<div class="client-info"><i class="fas fa-envelope"></i> ${client.email}</div>` : ''}
            ${client.phone ? `<div class="client-info"><i class="fas fa-phone"></i> ${client.phone}</div>` : ''}
            <div class="client-actions">
                <button onclick="selectClient('${client._id}', event)" title="Open client screens">
                    Screens
                </button>
                <button onclick="editClient('${client._id}', event)" title="Edit client">
                    Settings
                </button>
            </div>
        `;
        clientsList.appendChild(li);
    });
}

// Select client and view their screens
async function selectClient(clientId, event) {
    if (event) event.stopPropagation();
    
    navigateTo(`/client/${clientId}`);
}

// Load client screens (called by router)
async function loadClientScreens(clientId) {
    currentClient = clientId;
    currentMode = 'default'; // We're viewing screens, but client screens
    
    showLoader();
    try {
        const response = await fetch(`/api/clients/${clientId}`);
        const data = await response.json();
        screens = data.screens || []; // Ensure it's an array
        
        updateUI();
        renderScreens();
        
        // Highlight client in list if clients view is visible
        document.querySelectorAll('.client-item').forEach(item => {
            item.classList.remove('selected');
        });
        const clientItem = document.querySelector(`[data-client-id="${clientId}"]`);
        if (clientItem) {
            clientItem.classList.add('selected');
        }
    } catch (error) {
        console.error('Error loading client data:', error);
        alert('Error loading client data');
        // Set empty screens on error
        screens = [];
        updateUI();
        renderScreens();
    } finally {
        hideLoader();
    }
}

// Load screens
async function loadScreens() {
    showLoader();
    try {
        let url;
        if (currentClient) {
            url = `/api/screens?clientId=${currentClient}`;
        } else if (currentTemplate) {
            url = `/api/screens?templateId=${currentTemplate}`;
        } else {
            url = '/api/screens?isDefault=true';
        }
        const response = await fetch(url);
        screens = await response.json();
        updateUI();
        renderScreens();
    } catch (error) {
        console.error('Error loading screens:', error);
        alert('Error loading screens');
    } finally {
        hideLoader();
    }
}

// Update screen count
function updateScreenCount() {
    const countEl = document.getElementById('screen-count');
    if (countEl) {
        const count = screens.length;
        countEl.textContent = `${count} screen${count !== 1 ? 's' : ''}`;
    }
}

// Render screens with preview
function renderScreens() {
    const screensList = document.getElementById('screens-list');
    const emptyScreens = document.getElementById('empty-screens');
    if (!screensList) return;
    
    screensList.innerHTML = '';
    
    // Update screen count first (before checking for empty)
    updateScreenCount();

    if (screens.length === 0) {
        if (emptyScreens) emptyScreens.style.display = 'block';
        return;
    }
    
    if (emptyScreens) emptyScreens.style.display = 'none';

    // Sort screens by order
    screens.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    screens.forEach(screen => {
        const li = createScreenItem(screen);
        screensList.appendChild(li);
    });
    
    // Initialize drag-and-drop for screens
    initScreenDragAndDrop();
}

// Create screen item with preview
function createScreenItem(screen) {
    const li = document.createElement('li');
    li.className = 'screen-item';
    li.dataset.screenId = screen._id;
    
    // Create preview using iframe
    const previewHtml = screen.editedHtml || screen.originalHtml || '';
    const previewId = `preview-${screen._id}`;
    
    // Create tags display
    const tagsDisplay = screen.tags && screen.tags.length > 0 
        ? `<div class="screen-tags">
            ${screen.tags.map(tag => `<span class="tag-badge" title="Tag: ${escapeHtml(tag)}"><i class="fas fa-tag" style="font-size: 9px; margin-right: 4px; opacity: 0.7;"></i>${escapeHtml(tag)}</span>`).join('')}
           </div>`
        : '';
    
    li.innerHTML = `
        <div class="screen-header">
            <div style="flex: 1;">
                <span onclick="selectScreen('${screen._id}')">${screen.name}</span>
                ${tagsDisplay}
            </div>
            <div class="actions">
                <button onclick="duplicateScreen('${screen._id}')" title="Duplicate">
                    <i class="fas fa-copy"></i>
                </button>
                <button onclick="editScreenInModal('${screen._id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteScreen('${screen._id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="screen-preview-wrapper">
            <div class="duplicate-overlay">
                <button class="duplicate-btn" onclick="selectScreen('${screen._id}')" title="Edit screen">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <iframe id="${previewId}" class="screen-preview-iframe" frameborder="0" scrolling="no"></iframe>
        </div>
    `;
    
    // Set iframe content after element is added to DOM
    setTimeout(() => {
        const iframe = document.getElementById(previewId);
        if (iframe && previewHtml) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                
                // Додати клас "full" до body або головного контейнера в HTML (тільки всередині iframe)
                let modifiedHtml = previewHtml;
                
                // Перевірити чи є body тег
                if (modifiedHtml.includes('<body')) {
                    // Додати клас до body
                    modifiedHtml = modifiedHtml.replace(/<body([^>]*)>/i, (match, attrs) => {
                        // Перевірити чи вже є клас full
                        if (attrs && attrs.includes('class=')) {
                            // Додати клас до існуючого атрибута class
                            return match.replace(/class="([^"]*)"/i, (m, classes) => {
                                if (!classes.includes('full')) {
                                    return `class="${classes} full"`;
                                }
                                return m;
                            });
                        } else {
                            // Додати новий атрибут class
                            return `<body class="full"${attrs}>`;
                        }
                    });
                } else {
                    // Якщо немає body, знайти головний div з класом print-scope
                    if (modifiedHtml.includes('class="print-scope')) {
                        modifiedHtml = modifiedHtml.replace(/class="print-scope([^"]*)"/i, (match, classes) => {
                            if (!classes || !classes.includes('full')) {
                                return `class="print-scope${classes || ''} full"`;
                            }
                            return match;
                        });
                    } else if (modifiedHtml.includes("class='print-scope")) {
                        modifiedHtml = modifiedHtml.replace(/class='print-scope([^']*)'/i, (match, classes) => {
                            if (!classes || !classes.includes('full')) {
                                return `class='print-scope${classes || ''} full'`;
                            }
                            return match;
                        });
                    } else if (modifiedHtml.includes('class="slide')) {
                        // Знайти перший div з класом slide
                        modifiedHtml = modifiedHtml.replace(/class="slide([^"]*)"/i, (match, classes) => {
                            if (!classes || !classes.includes('full')) {
                                return `class="slide${classes || ''} full"`;
                            }
                            return match;
                        });
                    } else {
                        // Якщо немає нічого, обгорнути в body з класом full
                        if (!modifiedHtml.includes('<body')) {
                            // Якщо немає навіть html тега, додати повну структуру
                            if (!modifiedHtml.includes('<html')) {
                                modifiedHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body class="full">' + modifiedHtml + '</body></html>';
                            } else {
                                modifiedHtml = modifiedHtml.replace(/<html([^>]*)>/i, (match, attrs) => {
                                    return match + '<body class="full">';
                                });
                                if (!modifiedHtml.includes('</body>')) {
                                    modifiedHtml = modifiedHtml.replace(/<\/html>/i, '</body></html>');
                                }
                            }
                        }
                    }
                }
                
                iframeDoc.open();
                iframeDoc.write(modifiedHtml);
                iframeDoc.close();
            } catch (error) {
                console.error('Error setting iframe content:', error);
            }
        }
    }, 100);
    
    return li;
}

// Select screen
async function selectScreen(screenId) {





    showLoader();
    try {
        const response = await fetch(`/api/screens/${screenId}`);
        currentScreen = await response.json();
        
        document.querySelectorAll('.screen-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-screen-id="${screenId}"]`)?.classList.add('selected');
        
        const nameEl = document.getElementById('current-screen-name');
        if (nameEl) {
            nameEl.textContent = currentScreen.name;
        }
        
        showPreview();

    } catch (error) {
        console.error('Error loading screen:', error);
        alert('Error loading screen');

    } finally {
        hideLoader();
        collapse();
    }


}

// Show preview with interactive elements
function showPreview() {
    const container = document.getElementById('preview-container');
    
    if (!currentScreen) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-mouse-pointer"></i>
                <p>Select a screen to view and edit</p>
            </div>
        `;
        return;
    }

    const html = currentScreen.editedHtml || currentScreen.originalHtml;
    
    // Створити iframe або використати div для відображення
    container.innerHTML = `
        <div class="preview-frame" id="preview-frame">
            ${html}
        </div>
    `;

    // Після вставки HTML зробити елементи інтерактивними
    setTimeout(() => {
        makeElementsEditable();
    }, 100);
}

// Зробити елементи редактованими
function makeElementsEditable() {
    const frame = document.getElementById('preview-frame');
    if (!frame) return;

    elementDataMap.clear();
    
    // Список елементів, які стали редактованими і мають дочірні елементи
    // Це буде заповнюватися пізніше, коли елементи стають редактованими
    const elementsWithChildren = new Set();

    // СПОЧАТКУ обробляємо img елементи
    const imageElements = frame.querySelectorAll('img');
    imageElements.forEach((el, index) => {
        const elementId = `edit-${Date.now()}-${index}-img`;
        el.classList.add('editable-element');
        el.dataset.editId = elementId;
        el.dataset.elementType = 'image';
        
        // Отримати width та height з атрибутів або з властивостей
        // Спочатку перевіряємо атрибути (це дає точне значення якщо воно встановлено)
        let width = el.getAttribute('width') || '';
        let height = el.getAttribute('height') || '';
        
        // Якщо атрибутів немає, але є натуральні розміри зображення, можемо їх використати
        // Але тільки якщо вони не встановлені через CSS
        if (!width && el.naturalWidth > 0) {
            // Не використовуємо naturalWidth бо це фізичний розмір, а не заданий
            // width залишаємо порожнім якщо немає атрибута
        }
        if (!height && el.naturalHeight > 0) {
            // height залишаємо порожнім якщо немає атрибута
        }
        
        const elementData = {
            element: el,
            type: 'image',
            tagName: 'img',
            selector: generateSelector(el),
            src: el.src || '',
            alt: el.alt || '',
            title: el.getAttribute('title') || '',
            width: width,
            height: height,
            className: el.className || '',
            styles: el.getAttribute('style') || '',
        };
        
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditSidebar(elementId);
        });
        
        // Додати візуальний індикатор що зображення редактоване
        el.style.cursor = 'pointer';
        
        elementDataMap.set(elementId, elementData);
    });

    // ПОТІМ обробляємо form елементи (input, select, textarea), щоб вони не були оброблені як текстові
    const formElements = frame.querySelectorAll('input, select, textarea');
    formElements.forEach((el, index) => {
        const elementId = `edit-${Date.now()}-${index}-form`;
        el.classList.add('editable-element');
        el.dataset.editId = elementId;
        el.dataset.elementType = el.tagName.toLowerCase();
        
        const tagName = el.tagName.toLowerCase();
        let elementData = {
            element: el,
            type: tagName,
            selector: generateSelector(el),
            name: el.name || '',
            label: el.getAttribute('label') || el.closest('label')?.textContent?.trim() || '',
        };

        if (tagName === 'select') {
            const options = Array.from(el.options).map(opt => ({
                value: opt.value,
                text: opt.textContent,
                selected: opt.selected,
            }));
            // Якщо немає опцій, додаємо дефолтну
            if (options.length === 0) {
                options.push({
                    value: '',
                    text: '— Select —',
                    selected: true,
                });
            }
            elementData.options = options;
            elementData.value = el.value || options[0]?.value || '';
            
            // Заборонити дефолтну поведінку select та відкрити сайдбар
            // Використовуємо capture: true щоб перехопити подію до того як вона дійде до батьківських елементів
            const handleSelectClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                openEditSidebar(elementId);
                return false;
            };
            
            const handleSelectMousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            };
            
            const handleSelectFocus = (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.blur();
                return false;
            };
            
            // Додаємо обробники з capture: true для перехоплення на фазі захоплення
            el.addEventListener('mousedown', handleSelectMousedown, { capture: true, passive: false });
            el.addEventListener('click', handleSelectClick, { capture: true, passive: false });
            el.addEventListener('focus', handleSelectFocus, { capture: true, passive: false });
            
            // Також додаємо на фазі всплытия для уверенности
            el.addEventListener('mousedown', handleSelectMousedown, { passive: false });
            el.addEventListener('click', handleSelectClick, { passive: false });
            
            // Додаємо атрибут для ідентифікації
            el.setAttribute('data-editable-select', 'true');
            
            // Блокуємо стандартну поведінку через атрибуты та стилі
            el.style.pointerEvents = 'auto';
            el.style.cursor = 'pointer';
            el.style.userSelect = 'none';
            
            // Додаємо обробник через onclick для максимальної надійності
            el.onclick = handleSelectClick;
            el.onmousedown = handleSelectMousedown;
        } else if (tagName === 'input' && el.type === 'checkbox') {
            elementData.checked = el.checked;
            
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditSidebar(elementId);
            });
        } else {
            elementData.value = el.value || '';
            
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditSidebar(elementId);
            });
        }

        elementDataMap.set(elementId, elementData);
    });

    // Знайти списки (ul, ol)
    const lists = frame.querySelectorAll('ul, ol');
    lists.forEach((list, index) => {
        const elementId = `edit-${Date.now()}-${index}-list`;
        list.classList.add('editable-element');
        list.dataset.editId = elementId;
        list.dataset.elementType = 'list';
        
        // Перевірити чи є HTML елементи в li
        const liElements = Array.from(list.querySelectorAll('li'));
        const hasHtmlInItems = liElements.some(li => {
            // Перевірити чи є дочірні HTML елементи (не тільки текст)
            return li.children.length > 0 || (li.innerHTML.trim() !== li.textContent.trim());
        });
        
        // Якщо є HTML, зберігаємо innerHTML, інакше textContent
        const items = liElements.map(li => {
            const hasHtml = li.children.length > 0 || (li.innerHTML.trim() !== li.textContent.trim());
            const liStyles = li.getAttribute('style') || '';
            
            // Зібрати стилі для внутрішніх елементів
            const elementStyles = {};
            if (hasHtml) {
                const itemHtml = li.innerHTML;
                const parsedElements = parseHTMLContent(itemHtml, true); // true = isListItem
                const editableTags = ['span', 'strong', 'em', 'b', 'i', 'mark', 'code', 'kbd', 'abbr', 'small', 'sup', 'sub', 'time', 'bdi', 'bdo', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
                
                parsedElements.forEach((parsedElem, idx) => {
                    if (parsedElem.type === 'element') {
                        // Знайти відповідний DOM елемент
                        const elementsOfTag = Array.from(li.querySelectorAll(parsedElem.tagName));
                        const elementIndex = parsedElements.filter((e, i) => 
                            i < idx && e.type === 'element' && e.tagName === parsedElem.tagName
                        ).length;
                        
                        if (elementsOfTag[elementIndex]) {
                            const elemStyle = elementsOfTag[elementIndex].getAttribute('style') || '';
                            if (elemStyle) {
                                elementStyles[parsedElem.id] = elemStyle;
                            }
                        }
                    }
                });
            }
            
            return {
                text: li.textContent.trim(),
                html: hasHtml ? li.innerHTML : null,
                hasHtml: hasHtml,
                styles: liStyles,
                elementStyles: Object.keys(elementStyles).length > 0 ? elementStyles : undefined
            };
        });
        
        // Додати унікальний клас для списку з HTML
        if (hasHtmlInItems) {
            list.classList.add('list-with-html');
        }
        
        elementDataMap.set(elementId, {
            element: list,
            type: 'list',
            selector: generateSelector(list),
            items: items,
            listType: list.tagName.toLowerCase(),
            hasHtmlItems: hasHtmlInItems,
        });

        list.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditSidebar(elementId);
        });
    });

    // ПОТІМ обробляємо текстові елементи, включаючи нові теги
    // Важливо: це робиться після form елементів, щоб вони не були оброблені як текстові
    const textElements = frame.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, td, th, li, label, strong, em, b, i, mark, code, kbd, abbr, small, sup, sub, time, bdi, bdo, a');
    textElements.forEach((el, index) => {
        // Пропускаємо елементи, які вже оброблені як form елементи
        if (el.classList.contains('editable-element') && el.dataset.elementType !== 'text') {
            return;
        }
        
        // Пропускаємо самі form елементи
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
            return;
        }
        
        // Пропускаємо елементи, які містять всередині form елементи (input, select, textarea)
        // АБО які є прямими батьками form елементів
        const hasFormChild = el.querySelector('input, select, textarea');
        if (hasFormChild) {
            // Перевіряємо чи це не прямий батько form елемента
            const directFormChild = Array.from(el.children).find(child => 
                child.tagName === 'INPUT' || child.tagName === 'SELECT' || child.tagName === 'TEXTAREA'
            );
            // Якщо це прямий батько form елемента, пропускаємо цей елемент повністю
            if (directFormChild) {
                return;
            }
        }
        
        // Перевіряємо чи це не form елемент або його частина
        if (isInputElement(el)) {
            return;
        }
        
        const text = el.textContent.trim();
        // Перевіряємо чи це не вкладений елемент всередині іншого редактованого елемента
        const closestEditable = el.closest('.editable-element');
        const isNested = closestEditable !== null && closestEditable !== el;
        
        // Перевіряємо чи батьківський елемент не є form елементом
        const parentIsForm = el.parentElement && (
            el.parentElement.tagName === 'INPUT' || 
            el.parentElement.tagName === 'SELECT' || 
            el.parentElement.tagName === 'TEXTAREA'
        );
        
        // Для блочних елементів перевіряємо чи є прямий текстовий контент на першому рівні
        const isBlockElement = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'LABEL'].includes(el.tagName);
        let hasDirectText = true; // За замовчуванням true для inline елементів
        
        if (isBlockElement) {
            // Перевіряємо чи є серед прямих дітей текстові вузли (не порожні)
            hasDirectText = false;
            for (let i = 0; i < el.childNodes.length; i++) {
                const node = el.childNodes[i];
                // Якщо це текстовый вузол і він не порожній (після trim)
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                    hasDirectText = true;
                    break;
                }
            }
        }
        
        // Для inline елементів перевіряємо чи батько не редактований
        const isInline = ['EM', 'STRONG', 'MARK', 'CODE', 'KBD', 'ABBR', 'SMALL', 'SUP', 'SUB', 'TIME', 'BDI', 'BDO', 'SPAN', 'A'].includes(el.tagName);
        let shouldSkipInline = false;
        
        if (isInline) {
            // Перевіряємо чи батько вже є редактованим або в списку елементів з дочірніми
            let parent = el.parentElement;
            while (parent && parent !== frame) {
                if (parent.classList.contains('editable-element')) {
                    shouldSkipInline = true;
                    break;
                }
                if (elementsWithChildren.has(parent)) {
                    shouldSkipInline = true;
                    break;
                }
                parent = parent.parentElement;
            }
        }
        
        if (text && !isNested && !parentIsForm && hasDirectText && !shouldSkipInline) {
            
            const elementId = `edit-${Date.now()}-${index}`;
            el.classList.add('editable-element');
            el.dataset.editId = elementId;
            el.dataset.elementType = 'text';
            
            // Перевіряємо чи є дочірні елементи (HTML структура)
            // Не считаем <br> теги как дочерние элементы для hasChildren
            const hasChildren = Array.from(el.children).some(child => 
                child.nodeType === 1 && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE' && child.tagName !== 'BR' &&
                ['EM', 'STRONG', 'MARK', 'CODE', 'KBD', 'ABBR', 'SMALL', 'SUP', 'SUB', 'TIME', 'BDI', 'BDO', 'SPAN', 'A', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(child.tagName)
            );
            const innerHTML = hasChildren ? el.innerHTML : '';
            
            // Додаємо в elementsWithChildren тільки якщо елемент став редактованим і має дочірні елементи
            if (hasChildren) {
                elementsWithChildren.add(el);
            }
            
            // Зберегти стилі та атрибути для inline елементів
            const styles = el.getAttribute('style') || '';
            const className = el.className || '';
            const href = el.tagName === 'A' ? el.getAttribute('href') || '' : '';
            const title = el.tagName === 'ABBR' ? el.getAttribute('title') || '' : '';
            const datetime = el.tagName === 'TIME' ? el.getAttribute('datetime') || '' : '';
            const dir = el.tagName === 'BDO' ? el.getAttribute('dir') || '' : '';
            
            // Сохраняем innerHTML даже если hasChildren = false, на случай если есть <br>
            const innerHTMLForStorage = el.innerHTML || '';
            
            // Если в элементе только <br> теги (и текст), то originalText должен содержать HTML с <br>
            // Проверяем, есть ли в элементе только <br> теги
            const hasOnlyBr = Array.from(el.children).every(child => 
                child.nodeType === 1 && child.tagName === 'BR'
            ) && el.children.length > 0;
            
            // Определяем originalText: если только <br>, используем innerHTML, иначе textContent
            const originalText = hasOnlyBr ? innerHTMLForStorage : text;
            
            elementDataMap.set(elementId, {
                element: el,
                type: 'text',
                originalText: originalText, // Если только <br>, содержит HTML с <br>
                originalHTML: innerHTMLForStorage, // Зберігаємо HTML навіть якщо немає дочірніх елементів (для <br>)
                hasChildren: hasChildren, // Прапорець що є дочірні елементи
                tagName: el.tagName.toLowerCase(),
                selector: generateSelector(el),
                styles: styles,
                className: className,
                href: href,
                title: title,
                datetime: datetime,
                dir: dir,
            });

            el.addEventListener('click', (e) => {
                // Перевіряємо чи клік не був на form елементі
                const target = e.target;
                
                // Перевіряємо сам елемент та всі його батьківські елементи
                let currentTarget = target;
                while (currentTarget && currentTarget !== el) {
                    if (currentTarget.tagName === 'INPUT' || 
                        currentTarget.tagName === 'SELECT' || 
                        currentTarget.tagName === 'TEXTAREA' ||
                        currentTarget.hasAttribute('data-editable-select')) {
                        return; // Дозволяємо form елементам обробляти свої кліки
                    }
                    currentTarget = currentTarget.parentElement;
                }
                
                // Також перевіряємо чи клік був на самому form елементі
                if (target.tagName === 'INPUT' || 
                    target.tagName === 'SELECT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.hasAttribute('data-editable-select')) {
                    return;
                }
                
                e.stopPropagation();
                e.preventDefault();
                openEditSidebar(elementId);
            });
        }
    });
}

// Перевірити чи елемент є input
function isInputElement(el) {
    return el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || 
           el.tagName === 'BUTTON' || el.closest('input, select, textarea, button');
}

// Генерувати селектор для елемента
function generateSelector(element) {
    if (element.id) {
        return `#${element.id}`;
    }
    
    let selector = element.tagName.toLowerCase();
    
    if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c).join('.');
        if (classes) {
            selector = `.${classes}`;
        }
    }
    
    const siblings = Array.from(element.parentElement?.children || []);
    const sameTagSiblings = siblings.filter(s => s.tagName === element.tagName);
    const index = sameTagSiblings.indexOf(element);
    
    if (index >= 0 && sameTagSiblings.length > 1) {
        selector += `:nth-of-type(${index + 1})`;
    }
    
    return selector;
}

// Парсинг HTML контенту для створення окремих полів редагування
// Спочатку проходить по документу і ставить маркери на всі редагуємі елементи
// isListItem: если true, игнорируем <br> теги на верхнем уровне (которые были дочерними элементами <li>)
function parseHTMLContent(html, isListItem = false) {
    if (!html || !html.trim()) {
        return [{ type: 'text', content: '', id: 'text-0', originalHtml: html }];
    }
    
    // Используем временный div для парсинга, чтобы сохранить комментарии
    // DOMParser может не сохранять комментарии правильно
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const container = tempDiv;
    const elements = [];
    let textIndex = 0;
    let elementIndex = 0;
    
    const editableTags = ['span', 'strong', 'em', 'b', 'i', 'mark', 'code', 'kbd', 'abbr', 'small', 'sup', 'sub', 'time', 'bdi', 'bdo', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    
    // Крок 1: Пройти по документу і поставити маркери на всі редагуємі елементи
    // Для текстовых узлов используем комментарии HTML для маркировки, чтобы не изменять структуру
    function markEditableElements(node, path = []) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text && text.trim()) {
                const textId = `text-${textIndex++}`;
                
                // Используем data-атрибут на родительском элементе для маркировки текстового узла
                // Сохраняем информацию о текстовом узле в родительском элементе
                const parent = node.parentNode;
                if (parent && parent.nodeType === Node.ELEMENT_NODE) {
                    // Сохраняем информацию о текстовых узлах в data-атрибуте родителя
                    const textNodesInfo = parent.dataset.textNodesInfo || '[]';
                    const textNodes = JSON.parse(textNodesInfo);
                    textNodes.push({
                        id: textId,
                        index: Array.from(parent.childNodes).indexOf(node)
                    });
                    parent.dataset.textNodesInfo = JSON.stringify(textNodes);
                }
                
                elements.push({
                    type: 'text',
                    content: text.trim(),
                    id: textId,
                    path: [...path],
                    parentTag: parent ? parent.tagName.toLowerCase() : null,
                    nodeIndex: parent ? Array.from(parent.childNodes).indexOf(node) : -1
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            
            if (tagName === 'br') {
                // <br> могут быть только внутри элементов, которые непосредственно содержат текст
                // Игнорируем <br>, если они являются дочерними элементами контейнеров (div, li и т.д.)
                const parent = node.parentNode;
                if (parent && parent.nodeType === Node.ELEMENT_NODE) {
                    const parentTag = parent.tagName.toLowerCase();
                    
                    // Список текстовых элементов, внутри которых <br> допустимы
                    const textContainerTags = ['p', 'span', 'strong', 'em', 'b', 'i', 'mark', 'code', 'kbd', 'abbr', 'small', 'sup', 'sub', 'time', 'bdi', 'bdo', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'label'];
                    
                    // Список контейнерных элементов, внутри которых <br> не должны быть
                    const blockContainerTags = ['div', 'li', 'ul', 'ol', 'section', 'article', 'header', 'footer', 'nav', 'main', 'dl', 'dt', 'dd', 'table', 'tr', 'tbody', 'thead', 'tfoot', 'form', 'body', 'html'];
                    
                    // Если родитель - контейнерный элемент (не текстовый), игнорируем <br>
                    if (blockContainerTags.includes(parentTag) && !textContainerTags.includes(parentTag)) {
                        // Пропускаем обработку <br> в контейнерных элементах
                        return;
                    }
                    
                    // Если парсим элемент списка и <br> на верхнем уровне (родитель - контейнер), игнорируем
                    if (isListItem && parent === container) {
                        // Пропускаем обработку <br> на верхнем уровне элемента списка
                        return;
                    }
                }
                
                // <br> теги обробляємо окремо (только если они внутри текстовых элементов)
                if (elements.length > 0 && elements[elements.length - 1].type === 'text') {
                    elements[elements.length - 1].content += '\n';
                } else {
                    const textId = `text-${textIndex++}`;
                    if (parent && parent.nodeType === Node.ELEMENT_NODE) {
                        const textNodesInfo = parent.dataset.textNodesInfo || '[]';
                        const textNodes = JSON.parse(textNodesInfo);
                        textNodes.push({
                            id: textId,
                            index: Array.from(parent.childNodes).indexOf(node)
                        });
                        parent.dataset.textNodesInfo = JSON.stringify(textNodes);
                    }
                    elements.push({
                        type: 'text',
                        content: '\n',
                        id: textId,
                        path: [...path],
                        parentTag: parent ? parent.tagName.toLowerCase() : null,
                        nodeIndex: parent ? Array.from(parent.childNodes).indexOf(node) : -1
                    });
                }
            } else if (editableTags.includes(tagName)) {
                // Це редагуємий елемент - ставимо маркер напряму на элемент
                const elementId = `element-${elementIndex++}`;
                node.setAttribute('data-edit-field-id', elementId);
                
                // Зберігаємо інформацію про елемент
                // Конвертуємо <br> в \n для збереження форматирования
                let textContent = '';
                Array.from(node.childNodes).forEach(child => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        textContent += child.textContent;
                    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'br') {
                        textContent += '\n';
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        // Для інших елементів додаємо їх текстовий вміст
                        textContent += child.textContent;
                    }
                });
                textContent = textContent.trim();
                
                const attributes = {};
                Array.from(node.attributes).forEach(attr => {
                    if (attr.name !== 'data-edit-field-id') {
                        attributes[attr.name] = attr.value;
                    }
                });
                
                elements.push({
                    type: 'element',
                    tagName: tagName,
                    content: textContent,
                    attributes: attributes,
                    id: elementId,
                    styles: attributes.style || ''
                });
            } else {
                // Для нередагуємих тегів обробляємо дочірні вузли
                const currentPath = [...path, { type: 'element', tag: tagName }];
                Array.from(node.childNodes).forEach((child, index) => {
                    markEditableElements(child, currentPath);
                });
            }
        }
    }
    
    // Обробляємо всі вузли контейнера
    const children = Array.from(container.childNodes);
    children.forEach(child => {
        markEditableElements(child);
    });
    
    // Об'єднати послідовні текстові елементи
    const mergedElements = [];
    let currentText = '';
    let currentTextId = null;
    
    elements.forEach(elem => {
        if (elem.type === 'text') {
            if (currentTextId === null) {
                currentTextId = elem.id;
                currentText = elem.content;
            } else {
                currentText += ' ' + elem.content; // Додаємо пробіл між текстами
            }
        } else {
            if (currentTextId !== null) {
                mergedElements.push({
                    type: 'text',
                    content: currentText,
                    id: currentTextId
                });
                currentText = '';
                currentTextId = null;
            }
            mergedElements.push(elem);
        }
    });
    
    if (currentTextId !== null) {
        mergedElements.push({
            type: 'text',
            content: currentText,
            id: currentTextId
        });
    }
    
    if (mergedElements.length === 0) {
        mergedElements.push({
            type: 'text',
            content: container.textContent.trim() || '',
            id: 'text-0'
        });
    }
    
    // Зберігаємо HTML з маркерами
    const markedHtml = container.innerHTML;
    mergedElements[0].originalHtml = markedHtml;
    
    return mergedElements;
}

// Удалить <br> теги, которые являются непосредственными дочерними элементами контейнеров
function removeInvalidBrTags(html) {
    if (!html || !html.trim()) return html;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Список текстовых элементов, внутри которых <br> допустимы
    const textContainerTags = ['p', 'span', 'strong', 'em', 'b', 'i', 'mark', 'code', 'kbd', 'abbr', 'small', 'sup', 'sub', 'time', 'bdi', 'bdo', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'label'];
    
    // Список контейнерных элементов, внутри которых <br> не должны быть
    const blockContainerTags = ['div', 'li', 'ul', 'ol', 'section', 'article', 'header', 'footer', 'nav', 'main', 'dl', 'dt', 'dd', 'table', 'tr', 'tbody', 'thead', 'tfoot', 'form', 'body', 'html'];
    
    // Найти все <br> теги
    const brTags = tempDiv.querySelectorAll('br');
    const brTagsArray = Array.from(brTags);
    
    // Удалить <br> теги, которые являются дочерними элементами контейнеров
    brTagsArray.forEach(br => {
        const parent = br.parentNode;
        if (parent && parent.nodeType === Node.ELEMENT_NODE) {
            const parentTag = parent.tagName.toLowerCase();
            
            // Если родитель - контейнерный элемент (не текстовый), удаляем <br>
            if (blockContainerTags.includes(parentTag) && !textContainerTags.includes(parentTag)) {
                br.remove();
            }
        }
    });
    
    return tempDiv.innerHTML;
}

// Збірка HTML з окремих полів редагування
// Використовує оригінальний HTML як шаблон для збереження структури
function buildHTMLFromFields(fields, elementStyles = {}) {
    if (!fields || fields.length === 0) {
        return '';
    }
    
    // Якщо є оригінальний HTML, використовуємо його як шаблон
    const originalHtml = fields[0]?.originalHtml;
    if (originalHtml) {
        // Використовуємо buildHTMLFromFieldsSimple для правильної обробки
        return buildHTMLFromFieldsSimple(fields, elementStyles, originalHtml);
    }
    
    // Якщо немає оригінального HTML, використовуємо простий підхід
    return buildHTMLFromFieldsSimple(fields, elementStyles);
}

// Проста збірка HTML без збереження структури (fallback)
// Використовує оригінальний HTML з маркерами і оновлює тільки вміст за маркерами
function buildHTMLFromFieldsSimple(fields, elementStyles = {}, originalHtml = null) {
    if (!fields || fields.length === 0) {
        return originalHtml || '';
    }
    
    // Якщо є оригінальний HTML з маркерами, використаємо його як шаблон
    if (originalHtml) {
        // Используем временный div для парсинга, чтобы сохранить комментарии
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalHtml;
        const container = tempDiv;
        
        // Створити мапу полів за ID
        const fieldsMap = new Map();
        fields.forEach(field => {
            if (field.id) {
                fieldsMap.set(field.id, field);
            } else {
                console.warn('Field without id:', field);
            }
        });
        
        // Знайти всі елементи з маркерами і оновити їх
        // Сначала обрабатываем текстовые узлы (по data-атрибутам на родителях), потом элементы
        const textFields = fields.filter(f => f.type === 'text');
        textFields.forEach(field => {
            // Для тексту: находим родительский элемент с информацией о текстовых узлах
            const allElements = container.querySelectorAll('*');
            allElements.forEach(element => {
                const textNodesInfo = element.dataset.textNodesInfo;
                if (textNodesInfo) {
                    try {
                        const textNodes = JSON.parse(textNodesInfo);
                        const textNodeInfo = textNodes.find(tn => tn.id === field.id);
                        if (textNodeInfo) {
                            // Нашли информацию о текстовом узле
                            const childNodes = Array.from(element.childNodes);
                            const textNode = childNodes[textNodeInfo.index];
                            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                                const newContent = field.content || '';
                                console.log('newContent', newContent);
                                // Сначала проверяем <br> (после замены \n на <br>)
                                if (newContent.includes('<br>')) {
                                    // Если содержимое содержит <br>, нужно создать фрагмент
                                    const fragment = document.createDocumentFragment();
                                    const parts = newContent.split('<br>');
                                    parts.forEach((part, idx) => {
                                        if (part) {
                                            fragment.appendChild(document.createTextNode(part));
                                        }
                                        if (idx < parts.length - 1) {
                                            fragment.appendChild(document.createElement('br'));
                                        }
                                    });
                                    element.replaceChild(fragment, textNode);
                                    // Обновляем индекс после замены
                                    textNodeInfo.index = Array.from(element.childNodes).indexOf(fragment.firstChild);
                                } else if (newContent.includes('\n')) {
                                    // Если есть переносы строк, заменяем текстовый узел на фрагмент
                                    const fragment = document.createDocumentFragment();
                                    const parts = newContent.split('\n');
                                    parts.forEach((part, idx) => {
                                        if (part) {
                                            fragment.appendChild(document.createTextNode(part));
                                        }
                                        if (idx < parts.length - 1) {
                                            fragment.appendChild(document.createElement('br'));
                                        }
                                    });
                                    element.replaceChild(fragment, textNode);
                                    // Обновляем индекс после замены
                                    textNodeInfo.index = Array.from(element.childNodes).indexOf(fragment.firstChild);
                                } else {
                                    // Просто обновляем текст, не трогая структуру
                                    textNode.textContent = newContent;
                                }
                            }
                        }
                    } catch (e) {
                        // Игнорируем ошибки парсинга
                    }
                }
            });
        });
        
        // Теперь обрабатываем редактируемые элементы
        const markedElements = container.querySelectorAll('[data-edit-field-id]');
        markedElements.forEach(markedElem => {
            const fieldId = markedElem.getAttribute('data-edit-field-id');
            const field = fieldsMap.get(fieldId);
            
            if (!field) return;
            
            if (field.type === 'element') {
                // Для редагуємих елементів: оновлюємо вміст
                // Обробляємо <br> теги в тексті
                const content = field.content || '';
                if (content.includes('<br>')) {
                    // Замінюємо <br> на реальні елементи
                    const fragment = document.createDocumentFragment();
                    const parts = content.split('<br>');
                    parts.forEach((part, idx) => {
                        if (part) {
                            fragment.appendChild(document.createTextNode(part));
                        }
                        if (idx < parts.length - 1) {
                            fragment.appendChild(document.createElement('br'));
                        }
                    });
                    // Очищаємо вміст і додаємо фрагмент
                    markedElem.textContent = '';
                    markedElem.appendChild(fragment);
                } else if (content.includes('\n')) {
                    // Замінюємо переноси рядків на <br>
                    const fragment = document.createDocumentFragment();
                    const parts = content.split('\n');
                    parts.forEach((part, idx) => {
                        if (part) {
                            fragment.appendChild(document.createTextNode(part));
                        }
                        if (idx < parts.length - 1) {
                            fragment.appendChild(document.createElement('br'));
                        }
                    });
                    // Очищаємо вміст і додаємо фрагмент
                    markedElem.textContent = '';
                    markedElem.appendChild(fragment);
                } else {
                    markedElem.textContent = content;
                }
                
                // Оновлюємо атрибути (крім style і data-edit-field-id)
                if (field.attributes) {
                    Object.keys(field.attributes).forEach(key => {
                        if (key !== 'style' && key !== 'data-edit-field-id') {
                            if (field.attributes[key]) {
                                markedElem.setAttribute(key, field.attributes[key]);
                            } else {
                                markedElem.removeAttribute(key);
                            }
                        }
                    });
                }
                
                // Оновлюємо стилі
                const elementStyle = elementStyles[field.id] || field.styles || '';
                if (elementStyle) {
                    markedElem.setAttribute('style', elementStyle);
                } else if (field.attributes && field.attributes.style) {
                    markedElem.setAttribute('style', field.attributes.style);
                } else {
                    markedElem.removeAttribute('style');
                }
                
                // НЕ видаляємо маркер - він залишається для наступних оновлень
                // markedElem.removeAttribute('data-edit-field-id');
            }
        });
        
        // Перед возвратом HTML нужно удалить data-атрибуты, которые использовались для маркировки
        // Но сохранить структуру HTML
        // Удаляем data-text-nodes-info, так как они нужны только для обновления
        container.querySelectorAll('[data-text-nodes-info]').forEach(el => {
            el.removeAttribute('data-text-nodes-info');
        });
        
        // Удаляем data-edit-field-id с редактируемых элементов перед сохранением
        container.querySelectorAll('[data-edit-field-id]').forEach(el => {
            el.removeAttribute('data-edit-field-id');
        });
        
        // Удалить недопустимые <br> теги перед возвратом HTML
        let cleanedHtml = container.innerHTML;
        cleanedHtml = removeInvalidBrTags(cleanedHtml);
        
        return cleanedHtml;
    }
    
    // Fallback: збираємо HTML з нуля (не повинно використовуватися, якщо є originalHtml)
    let html = '';
    fields.forEach(field => {
        if (field.type === 'text') {
            const content = (field.content || '').replace(/\n/g, '<br>');
            html += escapeHtml(content).replace(/&lt;br&gt;/g, '<br>');
        } else if (field.type === 'element') {
            let attrs = '';
            if (field.attributes) {
                Object.keys(field.attributes).forEach(key => {
                    const value = field.attributes[key];
                    if (key !== 'style' && value && value.trim() !== '') {
                        attrs += ` ${key}="${escapeHtml(value)}"`;
                    }
                });
            }
            
            const elementStyle = elementStyles[field.id] || field.styles || '';
            if (elementStyle) {
                attrs += ` style="${escapeHtml(elementStyle)}"`;
            }
            
            const content = escapeHtml(field.content || '');
            html += `<${field.tagName}${attrs}>${content}</${field.tagName}>`;
        }
    });
    
    // Удалить недопустимые <br> теги перед возвратом HTML
    html = removeInvalidBrTags(html);
    
    return html;
}

// Відкрити сайдбар редагування
function openEditSidebar(elementId) {
    const elementData = elementDataMap.get(elementId);
    if (!elementData) return;

    currentEditingElement = elementId;
    const sidebar = document.getElementById('edit-sidebar');
    const sidebarContent = document.getElementById('edit-sidebar-content');

    // Підсвітити елемент
    if (elementData.element) {
        elementData.element.classList.add('editing');
    }

    // Створити форму редагування залежно від типу
    let formHTML = '';
    const tagName = elementData.tagName || '';
    const tagIcon = getTagIcon(elementData.type);

    if (elementData.type === 'text') {
        // Визначити тип елемента для кращого відображення
        const elementTypeLabel = getElementTypeLabel(tagName);
        
        // Визначаємо чи використовувати HTML чи текст
        const hasChildren = elementData.hasChildren || false;
        // Если hasChildren = false, но в originalText есть <br>, используем originalHTML если он есть
        // Теперь originalText уже содержит <br> если в элементе только <br> теги
        let contentToEdit = hasChildren ? (elementData.originalHTML || elementData.originalText) : elementData.originalText;
        
        // Если в contentToEdit есть <br> и hasChildren = false, возможно элемент был сохранен с <br>
        // (для обратной совместимости, хотя теперь originalText уже должен содержать <br>)
        if (!hasChildren && contentToEdit && contentToEdit.includes('<br>') && elementData.originalHTML) {
            contentToEdit = elementData.originalHTML;
            
        }
        const isHTMLMode = hasChildren;
        
        if (isHTMLMode) {
            // Парсимо HTML і створюємо окремі поля
            const parsedElements = parseHTMLContent(contentToEdit);
            
            let fieldsHTML = '';
            parsedElements.forEach((elem, idx) => {
                if (elem.type === 'text') {
                    // Використовуємо textarea для всіх текстових полів, щоб зберегти форматирование
                    fieldsHTML += `
                        <div class="html-field-item" data-field-id="${elem.id}">
                            <label style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; display: block;">
                                <i class="fas fa-font"></i> Text
                            </label>
                            <textarea class="html-field-input" data-field-id="${elem.id}" rows="3" placeholder="Enter text... (use Enter for line breaks)" oninput="updateHTMLFieldPreview('${elem.id}', this.value)">${escapeHtml(elem.content)}</textarea>
                        </div>
                    `;
                } else if (elem.type === 'element') {
                    const tagIcon = getTagIcon(elem.tagName);
                    const tagLabel = getElementTypeLabel(elem.tagName);
                    fieldsHTML += `
                        <div class="html-field-item html-element-item" data-field-id="${elem.id}" data-tag-name="${elem.tagName}">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <label style="font-size: 12px; color: var(--text-secondary); font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                    <i class="${tagIcon}"></i> ${tagLabel} (&lt;${elem.tagName}&gt;)
                                </label>
                            </div>
                            <textarea class="html-field-input" data-field-id="${elem.id}" rows="3" 
                                   placeholder="Enter ${tagLabel.toLowerCase()} content... (use Enter for line breaks)" 
                                   oninput="updateHTMLFieldPreview('${elem.id}', this.value)">${escapeHtml(elem.content)}</textarea>
                            ${elem.tagName === 'a' && elem.attributes.href ? `
                                <input type="text" class="html-field-attr" data-field-id="${elem.id}" data-attr="href" 
                                       value="${escapeHtml(elem.attributes.href)}" 
                                       placeholder="URL (href)" 
                                       style="margin-top: 8px;"
                                       oninput="updateHTMLFieldAttribute('${elem.id}', 'href', this.value)" />
                            ` : ''}
                            ${elem.tagName === 'abbr' && elem.attributes.title ? `
                                <input type="text" class="html-field-attr" data-field-id="${elem.id}" data-attr="title" 
                                       value="${escapeHtml(elem.attributes.title)}" 
                                       placeholder="Full name (title)" 
                                       style="margin-top: 8px;"
                                       oninput="updateHTMLFieldAttribute('${elem.id}', 'title', this.value)" />
                            ` : ''}
                        </div>
                    `;
                }
            });
            
            formHTML = `
                <div class="edit-form-item">
                    <div class="element-type-badge">
                        <i class="${tagIcon}"></i> ${elementTypeLabel}
                    </div>
                    <label><i class="fas fa-font"></i> Content with HTML elements</label>
                    <div class="info-box" style="margin-bottom: 12px;">
                        <i class="fas fa-info-circle"></i> This element contains HTML structure. Edit each part separately below.
                    </div>
                    <div id="html-fields-container" class="html-fields-container">
                        ${fieldsHTML}
                    </div>
                    <textarea id="edit-text-value" style="display: none;">${escapeHtml(contentToEdit)}</textarea>
                    <textarea id="edit-text-original" style="display: none;">${escapeHtml(parsedElements[0]?.originalHtml || contentToEdit)}</textarea>
                </div>
            `;
        } else {
            // Простий текстовий режим
            // Заменяем <br> на переносы строк для отображения в textarea
            let contentForTextarea = contentToEdit || '';
            if (contentForTextarea.includes('<br>')) {
                contentForTextarea = contentForTextarea.replace(/<br\s*\/?>/gi, '\n');
            }
            
            const escapedContentForTextarea = contentForTextarea;
            formHTML = `
                <div class="edit-form-item">
                    <div class="element-type-badge">
                        <i class="${tagIcon}"></i> Text
                    </div>
                    <label><i class="fas fa-font"></i> Text</label>
                    <textarea id="edit-text-value" rows="5" placeholder="Enter text...">${escapedContentForTextarea}</textarea>
                </div>
            `;
        }
        
        // Додати поля для спеціальних атрибутів залежно від типу тега
        if (tagName === 'a') {
            formHTML += `
                <div class="edit-form-item" style="margin-top: 16px;">
                    <label><i class="fas fa-link"></i> Link (href)</label>
                    <input type="text" id="edit-href-value" value="${escapeHtml(elementData.href || '')}" placeholder="https://example.com" />
                </div>
            `;
        }
        
        if (tagName === 'abbr') {
            formHTML += `
                <div class="edit-form-item" style="margin-top: 16px;">
                    <label><i class="fas fa-info-circle"></i> Description (title)</label>
                    <input type="text" id="edit-title-value" value="${escapeHtml(elementData.title || '')}" placeholder="Full abbreviation name" />
                </div>
            `;
        }
        
        if (tagName === 'time') {
            formHTML += `
                <div class="edit-form-item" style="margin-top: 16px;">
                    <label><i class="fas fa-calendar"></i> Date/time (datetime)</label>
                    <input type="text" id="edit-datetime-value" value="${escapeHtml(elementData.datetime || '')}" placeholder="2025-11-06" />
                </div>
            `;
        }
        
        if (tagName === 'bdo') {
            formHTML += `
                <div class="edit-form-item" style="margin-top: 16px;">
                    <label><i class="fas fa-text-width"></i> Text direction (dir)</label>
                    <select id="edit-dir-value">
                        <option value="ltr" ${elementData.dir === 'ltr' ? 'selected' : ''}>Left to right (ltr)</option>
                        <option value="rtl" ${elementData.dir === 'rtl' ? 'selected' : ''}>Right to left (rtl)</option>
                    </select>
                </div>
            `;
        }
        
        // Додати кнопку для відкриття редактора стилів
        formHTML += `
            <div class="edit-form-item" style="margin-top: 16px;">
                <button type="button" class="btn btn-secondary" onclick="openStyleEditor('${elementId}')" style="width: 100%;">
                    <i class="fas fa-paint-brush"></i> Edit Styles
                </button>
            </div>
        `;
        
        formHTML += `
                <div class="selector-info">
                    <i class="fas fa-code"></i> Selector: <code>${elementData.selector}</code>
                </div>
            </div>
        `;
    } else if (elementData.type === 'input') {
        formHTML = `
            <div class="edit-form-item">
                <div class="element-type-badge">
                    <i class="${tagIcon}"></i> Input field
                </div>
                <label><i class="fas fa-keyboard"></i> Value${elementData.label ? `: ${elementData.label}` : ''}</label>
                <input type="text" id="edit-input-value" value="${escapeHtml(elementData.value || '')}" placeholder="Enter value..." />
                <div class="edit-form-item" style="margin-top: 16px;">
                    <button type="button" class="btn btn-secondary" onclick="openStyleEditor('${elementId}')" style="width: 100%;">
                        <i class="fas fa-paint-brush"></i> Edit Styles
                    </button>
                </div>
                <div class="selector-info">
                    <i class="fas fa-code"></i> Selector: <code>${elementData.selector}</code>
                </div>
            </div>
        `;
    } else if (elementData.type === 'select') {
        // Перевірити що опції існують
        if (!elementData.options || elementData.options.length === 0) {
            elementData.options = [{
                value: '',
                text: '— Select —',
                selected: true,
            }];
        }
        
        const optionsHTML = elementData.options.map((opt, idx) => `
            <div class="option-item">
                <div class="option-inputs">
                    <div class="option-input-group">
                        <label>Text</label>
                        <input type="text" class="option-text" value="${escapeHtml(opt.text)}" data-option-index="${idx}" oninput="updateOptionPreview(${idx}, 'text', this.value)" placeholder="Option text" />
                    </div>
                    <div class="option-input-group">
                        <label>Value</label>
                        <input type="text" class="option-value" value="${escapeHtml(opt.value)}" data-option-index="${idx}" oninput="updateOptionPreview(${idx}, 'value', this.value)" placeholder="Option value" />
                    </div>
                </div>
                <button type="button" class="btn-remove-option" onclick="removeOption(${idx})" title="Remove option">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

        formHTML = `
            <div class="edit-form-item">
                <div class="element-type-badge">
                    <i class="${tagIcon}"></i> Dropdown list
                </div>
                <label><i class="fas fa-list"></i> Current value${elementData.label ? `: ${elementData.label}` : ''}</label>
                <select id="edit-select-value" class="preview-select">
                    ${elementData.options.map(opt => 
                        `<option value="${escapeHtml(opt.value)}" ${opt.selected ? 'selected' : ''}>${escapeHtml(opt.text)}</option>`
                    ).join('')}
                </select>
                <div class="selector-info">
                    <i class="fas fa-code"></i> Selector: <code>${elementData.selector}</code>
                </div>
                <div class="options-section">
                    <div class="section-header-small">
                        <i class="fas fa-list-ul"></i> List options
                    </div>
                    <div id="options-list" class="options-list">
                        ${optionsHTML}
                    </div>
                    <button type="button" class="add-option-btn" onclick="addOption()">
                        <i class="fas fa-plus"></i> Add option
                    </button>
                </div>
                <div class="edit-form-item" style="margin-top: 16px;">
                    <button type="button" class="btn btn-secondary" onclick="openStyleEditor('${elementId}')" style="width: 100%;">
                        <i class="fas fa-paint-brush"></i> Edit Styles
                    </button>
                </div>
            </div>
        `;
    } else if (elementData.type === 'textarea') {
        formHTML = `
            <div class="edit-form-item">
                <div class="element-type-badge">
                    <i class="${tagIcon}"></i> Text area
                </div>
                <label><i class="fas fa-align-left"></i> Text${elementData.label ? `: ${elementData.label}` : ''}</label>
                <textarea id="edit-textarea-value" rows="8" placeholder="Enter text...">${escapeHtml(elementData.value || '')}</textarea>
                <div class="edit-form-item" style="margin-top: 16px;">
                    <button type="button" class="btn btn-secondary" onclick="openStyleEditor('${elementId}')" style="width: 100%;">
                        <i class="fas fa-paint-brush"></i> Edit Styles
                    </button>
                </div>
                <div class="selector-info">
                    <i class="fas fa-code"></i> Selector: <code>${elementData.selector}</code>
                </div>
            </div>
        `;
    } else if (elementData.type === 'list') {
        // Перевірити чи є HTML в елементах списку
        const hasHtmlItems = elementData.hasHtmlItems || false;
        
        let itemsHTML;
        if (hasHtmlItems) {
            // Якщо є HTML, парсимо і створюємо окремі поля для кожного елемента
            itemsHTML = elementData.items.map((item, idx) => {
                const itemHtml = item.html || item.text || '';
                const parsedElements = parseHTMLContent(itemHtml, true); // true = isListItem
                
                // Зберігаємо originalHtml з маркерами
                const markedHtml = parsedElements[0]?.originalHtml || itemHtml;
                
                let fieldsHTML = '';
                parsedElements.forEach((elem, elemIdx) => {
                if (elem.type === 'text') {
                    // Використовуємо textarea для всіх текстових полів, щоб зберегти форматирование
                    fieldsHTML += `
                        <div class="html-field-item" data-field-id="${elem.id}" data-item-index="${idx}">
                            <label style="font-size: 10px; color: var(--text-secondary); margin-bottom: 3px; display: block;">
                                <i class="fas fa-font"></i> Text
                            </label>
                            <textarea class="html-field-input list-item-html-field" data-field-id="${elem.id}" data-item-index="${idx}" rows="2" placeholder="Enter text... (use Enter for line breaks)" oninput="updateListItemHTMLField('${idx}', '${elem.id}', this.value)">${escapeHtml(elem.content)}</textarea>
                        </div>
                    `;
                } else if (elem.type === 'element') {
                    const tagIcon = getTagIcon(elem.tagName);
                    const tagLabel = getElementTypeLabel(elem.tagName);
                    fieldsHTML += `
                        <div class="html-field-item html-element-item" data-field-id="${elem.id}" data-item-index="${idx}" data-tag-name="${elem.tagName}">
                            <label style="font-size: 10px; color: var(--text-secondary); font-weight: 600; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                                <i class="${tagIcon}"></i> ${tagLabel} (&lt;${elem.tagName}&gt;)
                            </label>
                            <textarea class="html-field-input list-item-html-field" 
                                   data-field-id="${elem.id}" 
                                   data-item-index="${idx}"
                                   rows="2"
                                   placeholder="Enter ${tagLabel.toLowerCase()} content... (use Enter for line breaks)" 
                                   oninput="updateListItemHTMLField('${idx}', '${elem.id}', this.value)">${escapeHtml(elem.content)}</textarea>
                            ${elem.tagName === 'a' && elem.attributes.href ? `
                                <input type="text" class="html-field-attr list-item-html-field" 
                                       data-field-id="${elem.id}" 
                                       data-item-index="${idx}"
                                       data-attr="href" 
                                       value="${escapeHtml(elem.attributes.href)}" 
                                       placeholder="URL (href)" 
                                       style="margin-top: 4px;"
                                       oninput="updateListItemHTMLFieldAttribute('${idx}', '${elem.id}', 'href', this.value)" />
                            ` : ''}
                            ${elem.tagName === 'abbr' && elem.attributes.title ? `
                                <input type="text" class="html-field-attr list-item-html-field" 
                                       data-field-id="${elem.id}" 
                                       data-item-index="${idx}"
                                       data-attr="title" 
                                       value="${escapeHtml(elem.attributes.title)}" 
                                       placeholder="Full name (title)" 
                                       style="margin-top: 4px;"
                                       oninput="updateListItemHTMLFieldAttribute('${idx}', '${elem.id}', 'title', this.value)" />
                            ` : ''}
                        </div>
                    `;
                }
                });
                
                return `
                    <div class="list-item list-item-with-html" data-item-index="${idx}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <label style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Item ${idx + 1}</label>
                            <div style="display: flex; gap: 4px;">
                                <button type="button" class="btn-edit-item-styles" onclick="openListItemStyleEditor('${elementId}', ${idx})" title="Edit item styles" style="padding: 4px 8px; font-size: 11px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                                    <i class="fas fa-paint-brush"></i>
                                </button>
                                <button type="button" class="btn-remove-item" onclick="removeListItem(${idx})" title="Remove item">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="list-item-html-fields" data-item-index="${idx}">
                            ${fieldsHTML}
                        </div>
                        <textarea class="list-item-html-value" data-item-index="${idx}" style="display: none;">${escapeHtml(markedHtml)}</textarea>
                        <textarea class="list-item-html-original" data-item-index="${idx}" style="display: none;">${escapeHtml(markedHtml)}</textarea>
                    </div>
                `;
            }).join('');
        } else {
            // Якщо немає HTML, використовуємо прості input поля
            itemsHTML = elementData.items.map((item, idx) => {
                const itemText = typeof item === 'string' ? item : (item.text || '');
                return `
                    <div class="list-item">
                        <input type="text" class="list-item-input" value="${escapeHtml(itemText)}" data-item-index="${idx}" placeholder="List item" />
                        <div style="display: flex; gap: 4px;">
                            <button type="button" class="btn-edit-item-styles" onclick="openListItemStyleEditor('${elementId}', ${idx})" title="Edit item styles" style="padding: 4px 8px; font-size: 11px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-paint-brush"></i>
                            </button>
                            <button type="button" class="btn-remove-item" onclick="removeListItem(${idx})" title="Remove item">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        formHTML = `
            <div class="edit-form-item">
                <div class="element-type-badge">
                    <i class="${tagIcon}"></i> List
                </div>
                <label><i class="fas fa-list"></i> ${elementData.listType === 'ul' ? 'Bulleted' : 'Numbered'} list</label>
                ${hasHtmlItems ? '<p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Items contain HTML. Edit each part separately below.</p>' : ''}
                <div id="list-items" class="list-items${hasHtmlItems ? ' list-with-html' : ''}">
                    ${itemsHTML}
                </div>
                <button type="button" class="add-option-btn" onclick="addListItem()">
                    <i class="fas fa-plus"></i> Add item
                </button>
                <div class="edit-form-item" style="margin-top: 16px;">
                    <button type="button" class="btn btn-secondary" onclick="openStyleEditor('${elementId}')" style="width: 100%;">
                        <i class="fas fa-paint-brush"></i> Edit Styles
                    </button>
                </div>
                <div class="selector-info" style="margin-top: 16px;">
                    <i class="fas fa-code"></i> Selector: <code>${elementData.selector}</code>
                </div>
            </div>
        `;
    } else if (elementData.type === 'image') {
        // Форма для редагування зображення
        formHTML = `
            <div class="edit-form-item">
                <div class="element-type-badge">
                    <i class="${tagIcon}"></i> Image
                </div>
                
                <div class="form-group" style="margin-bottom: 16px;">
                    <label><i class="fas fa-image"></i> Current Image</label>
                    <div class="image-preview-container" style="margin-top: 8px;">
                        <img src="${elementData.src || ''}" alt="${elementData.alt || ''}" 
                             style="max-width: 100%; max-height: 200px; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 4px; background: var(--bg-secondary);" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div style="display: none; padding: 20px; text-align: center; color: var(--text-muted); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                            <i class="fas fa-image" style="font-size: 48px; margin-bottom: 8px;"></i>
                            <p>Image not available</p>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-upload"></i> Upload New Image (max 10MB)</label>
                    <div class="file-upload-area" id="image-upload-area" onclick="document.getElementById('edit-image-file').click()" style="padding: 20px; cursor: pointer;">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <p>Click to upload or drag and drop</p>
                        <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">PNG, JPG, GIF, WEBP (max 10MB)</p>
                        <input type="file" id="edit-image-file" accept="image/*" style="display: none;" onchange="handleImageUpload(event)">
                    </div>
                </div>
                
                <div class="form-group" style="margin-top: 16px; display: none !important;">
                    <label><i class="fas fa-tag"></i> Alt Text</label>
                    <input type="text" id="edit-image-alt" value="${escapeHtml(elementData.alt || '')}" placeholder="Alternative text for image" />
                </div>
                
                <div class="form-group" style="margin-top: 16px; display: none !important;">
                    <label><i class="fas fa-info-circle"></i> Title</label>
                    <input type="text" id="edit-image-title" value="${escapeHtml(elementData.title || '')}" placeholder="Image title" />
                </div>
                
                <!-- <div class="form-group" style="margin-top: 16px;">
                    <label style="margin-bottom: 12px;"><i class="fas fa-arrows-alt"></i> Dimensions</label>
                    <div style="display: flex; gap: 12px; align-items: flex-end;">
                        <div style="flex: 1;">
                            <label style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; display: block; font-weight: 500;">Width</label>
                            <input type="text" id="edit-image-width" class="form-control" value="${escapeHtml(elementData.width || '')}" placeholder="e.g., 300 or 50%" />
                        </div>
                        <div style="flex: 1;">
                            <label style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; display: block; font-weight: 500;">Height</label>
                            <input type="text" id="edit-image-height" class="form-control" value="${escapeHtml(elementData.height || '')}" placeholder="e.g., 200 or 50%" />
                        </div>
                    </div>
                    <p style="font-size: 11px; color: var(--text-muted); margin-top: 6px; margin-bottom: 0;">Enter number (pixels) or percentage (e.g., 50%)</p>
                </div> -->
                
                <div class="edit-form-item" style="margin-top: 16px;">
                    <button type="button" class="btn btn-secondary" onclick="openStyleEditor('${elementId}')" style="width: 100%;">
                        <i class="fas fa-paint-brush"></i> Edit Styles
                    </button>
                </div>
                
                <div class="selector-info" style="margin-top: 16px;">
                    <i class="fas fa-code"></i> Selector: <code>${elementData.selector}</code>
                </div>
            </div>
        `;
    }

    sidebarContent.innerHTML = formHTML + `
        <div class="sidebar-actions">
            <button class="save-btn" onclick="saveEdit()">
                <i class="fas fa-save"></i> Save
            </button>
            <button class="cancel-btn" onclick="closeEditSidebar()">
                <i class="fas fa-times"></i> Cancel
            </button>
        </div>
    `;

    // Додати клас list-with-html до контейнера списку, якщо потрібно
    if (elementData.type === 'list' && elementData.hasHtmlItems) {
        const listItems = document.getElementById('list-items');
        if (listItems) {
            listItems.classList.add('list-with-html');
        }
        
        // Застосувати стилі для внутрішніх елементів при відкритті сайдбара
        setTimeout(() => {
            applyListItemElementStyles(elementData);
        }, 100);
    }

    // Додати обробники подій для оновлення в реальному часі
    setupRealtimeUpdates(elementData);
    
    // Ініціалізувати CodeMirror для HTML режиму (тільки для текстових елементів, не для списків)
    if (elementData.type === 'text' && elementData.hasChildren) {
        // Перевірити чи є HTML поля (якщо є, не ініціалізувати CodeMirror)
        const htmlFieldsContainer = document.getElementById('html-fields-container');
        if (!htmlFieldsContainer) {
            setTimeout(() => {
                initializeCodeEditor();
            }, 100);
        }
    }

    sidebar.classList.add('open');
    document.getElementById('save-changes-btn').style.display = 'block';
}

// Ініціалізувати CodeMirror редактор
let codeEditor = null;
function initializeCodeEditor() {
    const textarea = document.getElementById('edit-text-value');
    const wrapper = document.getElementById('code-editor-wrapper');
    
    if (!textarea || !wrapper) {
        console.warn('CodeMirror: textarea or wrapper not found');
        return;
    }
    
    // Отримати початкове значення з textarea
    // Важливо: textarea містить неекранований HTML для CodeMirror
    let initialValue = textarea.value;
    
    // Якщо значення порожнє або містить тільки пробіли, спробувати отримати з elementData
    if (!initialValue || initialValue.trim().length === 0) {
        const elementData = elementDataMap.get(currentEditingElement);
        if (elementData && elementData.originalHTML) {
            initialValue = elementData.originalHTML;
            textarea.value = initialValue;
            console.log('Got value from elementData.originalHTML, length:', initialValue.length);
        }
    }
    
    console.log('Initializing CodeMirror with value, length:', initialValue ? initialValue.length : 0);
    console.log('First 100 characters:', initialValue ? initialValue.substring(0, 100) : 'empty');
    
    // Створити CodeMirror редактор
    try {
        codeEditor = CodeMirror(wrapper, {
            value: initialValue || '',
            mode: 'htmlmixed',
            theme: 'monokai',
            lineNumbers: true,
            lineWrapping: true,
            indentUnit: 2,
            tabSize: 2,
            indentWithTabs: false,
            autoCloseTags: true,
            matchTags: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            foldGutter: true,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
            extraKeys: {
                'Ctrl-Space': 'autocomplete',
                'Ctrl-J': 'toMatchingTag',
                'Ctrl-F': 'find',
                'Ctrl-H': 'replace',
                'Ctrl-/': 'toggleComment'
            }
        });
        
        // Оновити textarea при зміні в редакторі
        codeEditor.on('change', (cm) => {
            const value = cm.getValue();
            textarea.value = value;
            // Оновити preview
            const elementData = elementDataMap.get(currentEditingElement);
            if (elementData && elementData.type === 'text') {
                updateElementPreview('text', value, true);
            }
        });
        
        // Налаштувати розмір редактора
        codeEditor.setSize('100%', '300px');
        
        console.log('CodeMirror successfully initialized');
    } catch (e) {
        console.error('CodeMirror initialization error:', e);
    }
}

// Допоміжні функції
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTagIcon(tagName) {
    const iconMap = {
        'p': 'fas fa-paragraph',
        'h1': 'fas fa-heading',
        'h2': 'fas fa-heading',
        'h3': 'fas fa-heading',
        'h4': 'fas fa-heading',
        'h5': 'fas fa-heading',
        'h6': 'fas fa-heading',
        'span': 'fas fa-font',
        'em': 'fas fa-italic',
        'strong': 'fas fa-bold',
        'mark': 'fas fa-highlighter',
        'code': 'fas fa-code',
        'kbd': 'fas fa-keyboard',
        'abbr': 'fas fa-info-circle',
        'small': 'fas fa-text-height',
        'sup': 'fas fa-superscript',
        'sub': 'fas fa-subscript',
        'time': 'fas fa-calendar',
        'bdi': 'fas fa-language',
        'bdo': 'fas fa-text-width',
        'a': 'fas fa-link',
        'img': 'fas fa-image',
        'image': 'fas fa-image',
        'input': 'fas fa-keyboard',
        'select': 'fas fa-list',
        'textarea': 'fas fa-align-left',
        'list': 'fas fa-list-ul',
    };
    return iconMap[tagName] || 'fas fa-edit';
}

function getElementTypeLabel(tagName) {
    const labelMap = {
        'p': 'Paragraph',
        'h1': 'Heading 1',
        'h2': 'Heading 2',
        'h3': 'Heading 3',
        'h4': 'Heading 4',
        'h5': 'Heading 5',
        'h6': 'Heading 6',
        'span': 'Text element',
        'em': 'Italic',
        'strong': 'Bold',
        'mark': 'Highlight',
        'code': 'Code',
        'kbd': 'Keyboard',
        'abbr': 'Abbreviation',
        'small': 'Small text',
        'sup': 'Superscript',
        'sub': 'Subscript',
        'time': 'Date/time',
        'bdi': 'Isolated text',
        'bdo': 'Text direction',
        'a': 'Link',
    };
    return labelMap[tagName] || 'Text element';
}

// Налаштувати оновлення в реальному часі
function setupRealtimeUpdates(elementData) {
    if (elementData.type === 'text') {
        const textarea = document.getElementById('edit-text-value');
        if (textarea) {
            textarea.addEventListener('input', () => {
                updateElementPreview('text', textarea.value);
            });
        }
        
        // Додати обробники для спеціальних атрибутів
        const hrefInput = document.getElementById('edit-href-value');
        if (hrefInput) {
            hrefInput.addEventListener('input', () => {
                if (elementData.element.tagName === 'A') {
                    elementData.element.setAttribute('href', hrefInput.value);
                }
            });
        }
        
        const titleInput = document.getElementById('edit-title-value');
        if (titleInput) {
            titleInput.addEventListener('input', () => {
                if (elementData.element.tagName === 'ABBR') {
                    elementData.element.setAttribute('title', titleInput.value);
                }
            });
        }
        
        const datetimeInput = document.getElementById('edit-datetime-value');
        if (datetimeInput) {
            datetimeInput.addEventListener('input', () => {
                if (elementData.element.tagName === 'TIME') {
                    elementData.element.setAttribute('datetime', datetimeInput.value);
                }
            });
        }
        
        const dirSelect = document.getElementById('edit-dir-value');
        if (dirSelect) {
            dirSelect.addEventListener('change', () => {
                if (elementData.element.tagName === 'BDO') {
                    elementData.element.setAttribute('dir', dirSelect.value);
                }
            });
        }
    } else if (elementData.type === 'input') {
        const input = document.getElementById('edit-input-value');
        if (input) {
            input.addEventListener('input', () => {
                updateElementPreview('input', input.value);
            });
        }
    } else if (elementData.type === 'select') {
        const select = document.getElementById('edit-select-value');
        if (select) {
            // Дозволити зміну значення в сайдбарі (не блокувати)
            select.addEventListener('change', () => {
                updateElementPreview('select', select.value);
                // Оновити вибране значення в elementData
                if (elementData.options) {
                    elementData.options.forEach(opt => {
                        opt.selected = opt.value === select.value;
                    });
                }
                elementData.value = select.value;
            });
        }
    } else if (elementData.type === 'textarea') {
        const textarea = document.getElementById('edit-textarea-value');
        if (textarea) {
            textarea.addEventListener('input', () => {
                updateElementPreview('textarea', textarea.value);
            });
        }
    } else if (elementData.type === 'list') {
        const hasHtmlItems = elementData.hasHtmlItems || false;
        
        if (hasHtmlItems) {
            // Для списків з HTML використовуємо окремі поля, CodeMirror не потрібен
            // Оновлення вже обробляється через updateListItemHTMLField
        } else {
            // Оновлення списку при зміні пунктів (простий текст)
            const listInputs = document.querySelectorAll('.list-item-input');
            listInputs.forEach((input, index) => {
                input.addEventListener('input', () => {
                    updateListPreview(index, input.value, false);
                });
            });
        }
    } else if (elementData.type === 'image') {
        // Оновлення alt та title для зображення
        const altInput = document.getElementById('edit-image-alt');
        if (altInput) {
            altInput.addEventListener('input', () => {
                if (elementData.element) {
                    elementData.element.alt = altInput.value;
                }
            });
        }
        
        const titleInput = document.getElementById('edit-image-title');
        if (titleInput) {
            titleInput.addEventListener('input', () => {
                if (elementData.element) {
                    if (titleInput.value) {
                        elementData.element.setAttribute('title', titleInput.value);
                    } else {
                        elementData.element.removeAttribute('title');
                    }
                }
            });
        }
        
        // Оновлення width та height для зображення
        const widthInput = document.getElementById('edit-image-width');
        if (widthInput) {
            widthInput.addEventListener('input', () => {
                if (elementData.element) {
                    const value = widthInput.value.trim();
                    if (value) {
                        elementData.element.setAttribute('width', value);
                        // Також оновити стиль, якщо потрібно
                        if (value.includes('%')) {
                            elementData.element.style.width = value;
                        } else if (!isNaN(value)) {
                            elementData.element.width = parseInt(value);
                        }
                    } else {
                        elementData.element.removeAttribute('width');
                        elementData.element.style.width = '';
                    }
                }
            });
        }
        
        const heightInput = document.getElementById('edit-image-height');
        if (heightInput) {
            heightInput.addEventListener('input', () => {
                if (elementData.element) {
                    const value = heightInput.value.trim();
                    if (value) {
                        elementData.element.setAttribute('height', value);
                        // Також оновити стиль, якщо потрібно
                        if (value.includes('%')) {
                            elementData.element.style.height = value;
                        } else if (!isNaN(value)) {
                            elementData.element.height = parseInt(value);
                        }
                    } else {
                        elementData.element.removeAttribute('height');
                        elementData.element.style.height = '';
                    }
                }
            });
        }
    }
}

// Оновити попередній перегляд елемента
// Зберігаємо дані про HTML поля для поточного елемента
let htmlFieldsData = new Map();

// Оновлення preview при зміні HTML поля
function updateHTMLFieldPreview(fieldId, value) {

    if (!currentEditingElement) return;
    
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || !elementData.hasChildren) return;
    
    // Оновити дані поля
    if (!htmlFieldsData.has(currentEditingElement)) {
        htmlFieldsData.set(currentEditingElement, new Map());
    }
    const fields = htmlFieldsData.get(currentEditingElement);
    if (!fields.has(fieldId)) {
        fields.set(fieldId, {});
    }
    const fieldData = fields.get(fieldId);
    fieldData.content = value;
    
    // Зібрати всі поля
    const container = document.getElementById('html-fields-container');
    if (!container) return;
    
    const allFields = [];
    container.querySelectorAll('.html-field-item').forEach(item => {
        const id = item.dataset.fieldId;
        const input = item.querySelector('.html-field-input');
        if (input) {
            const fieldItem = fields.get(id) || {};
            fieldItem.type = item.classList.contains('html-element-item') ? 'element' : 'text';
            // Зберігаємо переноси рядків в тексті - вони будуть оброблені при збірці HTML
            fieldItem.content = input.value;
            
            // Зібрати атрибути
            if (fieldItem.type === 'element') {
                // Отримати tagName з data-атрибута (більш надійно)
                fieldItem.tagName = item.dataset.tagName || item.querySelector('label')?.textContent?.match(/\(&lt;(\w+)&gt;\)/)?.[1] || 'span';
                fieldItem.attributes = fieldItem.attributes || {};
                item.querySelectorAll('.html-field-attr').forEach(attrInput => {
                    const attrName = attrInput.dataset.attr;
                    fieldItem.attributes[attrName] = attrInput.value;
                });
            }
            
            allFields.push(fieldItem);
        }
    });
    
    // Отримати originalHtml з окремого textarea (там зберігається HTML з маркерами)
    const originalTextarea = document.getElementById('edit-text-original');
    const originalHtml = originalTextarea ? originalTextarea.value : null;
    
    // Якщо не знайдено, спробувати з основного textarea (для зворотної сумісності)
    let fallbackHtml = null;
    if (!originalHtml) {
        const textarea = document.getElementById('edit-text-value');
        fallbackHtml = textarea ? textarea.value : null;
        if (fallbackHtml && (fallbackHtml.includes('data-edit-field-id') || fallbackHtml.includes('data-text-nodes-info'))) {
            allFields[0].originalHtml = fallbackHtml;
        }
    } else {
        // Додати originalHtml до першого поля, якщо є
        if (allFields.length > 0) {
            allFields[0].originalHtml = originalHtml;
        }
    }
    
    // Перед збіркою HTML замінити переноси рядків на <br> в тексті полів
    // Це простіший підхід - просто обробляємо переноси в тексті
    allFields.forEach(field => {
        if (field.content && field.content.includes('\n')) {
            // Замінюємо переноси рядків на <br> в тексті
            field.content = field.content.replace(/\n/g, '<br>');
        }
    });
    
    // Зібрати HTML
    let html = buildHTMLFromFields(allFields);
    
    // Оновити textarea
    const textarea = document.getElementById('edit-text-value');
    if (textarea) {
        textarea.value = html;
    }
    
    // Оновити preview
    updateElementPreview('text', html, true);
}

// Оновлення атрибута HTML поля
function updateHTMLFieldAttribute(fieldId, attrName, value) {
    if (!currentEditingElement) return;
    
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || !elementData.hasChildren) return;
    
    if (!htmlFieldsData.has(currentEditingElement)) {
        htmlFieldsData.set(currentEditingElement, new Map());
    }
    const fields = htmlFieldsData.get(currentEditingElement);
    if (!fields.has(fieldId)) {
        fields.set(fieldId, {});
    }
    const fieldData = fields.get(fieldId);
    if (!fieldData.attributes) {
        fieldData.attributes = {};
    }
    fieldData.attributes[attrName] = value;
    
    // Оновити preview
    updateHTMLFieldPreview(fieldId, fieldData.content || '');
}

// Оновлення HTML поля в елементі списку
function updateListItemHTMLField(itemIndex, fieldId, value) {
    if (!currentEditingElement) return;
    
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || elementData.type !== 'list') return;
    
    // Зібрати всі поля для цього елемента списку
    const itemContainer = document.querySelector(`.list-item-html-fields[data-item-index="${itemIndex}"]`);
    if (!itemContainer) return;
    
    // Отримати originalHtml з окремого textarea (там зберігається HTML з маркерами)
    // Використовуємо окремий textarea для originalHtml, щоб він не втрачався при оновленнях
    const originalTextarea = document.querySelector(`.list-item-html-original[data-item-index="${itemIndex}"]`);
    let originalHtml = originalTextarea ? originalTextarea.value : null;
    
    // Якщо не знайдено, спробувати з основного textarea (для зворотної сумісності)
    if (!originalHtml) {
        const textarea = document.querySelector(`.list-item-html-value[data-item-index="${itemIndex}"]`);
        originalHtml = textarea ? textarea.value : null;
    }
    
    const allFields = [];
    itemContainer.querySelectorAll('.html-field-item').forEach(item => {
        const id = item.dataset.fieldId;
        const input = item.querySelector('.html-field-input');
        if (input) {
            const fieldItem = {
                id: id, // Важливо: зберігаємо id для пошуку по маркерах
                type: item.classList.contains('html-element-item') ? 'element' : 'text',
                content: input.value
            };
            
            // Зібрати атрибути для елементів
            if (fieldItem.type === 'element') {
                // Отримати tagName з data-атрибута (більш надійно)
                fieldItem.tagName = item.dataset.tagName || item.querySelector('label')?.textContent?.match(/\(&lt;(\w+)&gt;\)/)?.[1] || 'span';
                fieldItem.attributes = {};
                item.querySelectorAll('.html-field-attr').forEach(attrInput => {
                    const attrName = attrInput.dataset.attr;
                    fieldItem.attributes[attrName] = attrInput.value;
                });
            }
            
            allFields.push(fieldItem);
        }
    });
    
    // Перед збіркою HTML замінити переноси рядків на <br> в тексті полів
    // Це простіший підхід - просто обробляємо переноси в тексті
    allFields.forEach(field => {
        if (field.content && field.content.includes('\n')) {
            // Замінюємо переноси рядків на <br> в тексті
            field.content = field.content.replace(/\n/g, '<br>');
        }
    });
    
    // Додати originalHtml до першого поля, якщо є
    if (allFields.length > 0 && originalHtml) {
        allFields[0].originalHtml = originalHtml;
    }
    
    // Зібрати стилі для внутрішніх елементів
    const itemData = elementData.items[itemIndex];
    const elementStyles = (itemData && typeof itemData === 'object' && itemData.elementStyles) ? itemData.elementStyles : {};
    
    // Зібрати HTML з урахуванням стилів та originalHtml
    const html = buildHTMLFromFields(allFields, elementStyles);
    
    // Оновити textarea
    const textarea = document.querySelector(`.list-item-html-value[data-item-index="${itemIndex}"]`);
    if (textarea) {
        textarea.value = html;
    }
    
    // Оновити preview
    updateListPreview(itemIndex, html, true);
    
    // Застосувати стилі до внутрішніх елементів в DOM
    const liElements = elementData.element.querySelectorAll('li');
    if (liElements[itemIndex] && elementStyles && Object.keys(elementStyles).length > 0) {
        const editableTags = ['span', 'strong', 'em', 'b', 'i', 'mark', 'code', 'kbd', 'abbr', 'small', 'sup', 'sub', 'time', 'bdi', 'bdo', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        
        // Знайти елементи за порядком і застосувати стилі
        allFields.forEach((field, idx) => {
            if (field.type === 'element' && elementStyles[field.id]) {
                // Знайти відповідний DOM елемент (використовуємо toLowerCase для надійності)
                const tagNameLower = field.tagName.toLowerCase();
                const elementsOfTag = Array.from(liElements[itemIndex].querySelectorAll(tagNameLower));
                const elementIndex = allFields.filter((f, i) => 
                    i < idx && f.type === 'element' && f.tagName === field.tagName
                ).length;
                
                if (elementsOfTag[elementIndex]) {
                    elementsOfTag[elementIndex].setAttribute('style', elementStyles[field.id]);
                } else {
                    // Якщо не знайдено, спробувати знайти всі елементи цього типу
                    const allInnerElements = Array.from(liElements[itemIndex].querySelectorAll('*'));
                    const matchingElements = allInnerElements.filter(el => 
                        el.tagName.toLowerCase() === tagNameLower
                    );
                    
                    if (matchingElements[elementIndex]) {
                        matchingElements[elementIndex].setAttribute('style', elementStyles[field.id]);
                    }
                }
            }
        });
    }
}

// Застосувати стилі для внутрішніх елементів списку
function applyListItemElementStyles(elementData) {
    if (!elementData || elementData.type !== 'list' || !elementData.hasHtmlItems) return;
    
    const listElement = elementData.element;
    if (!listElement) return;
    
    const liElements = listElement.querySelectorAll('li');
    
    elementData.items.forEach((item, itemIndex) => {
        if (item && typeof item === 'object' && item.elementStyles && liElements[itemIndex]) {
            const itemHtml = item.html || '';
            if (!itemHtml) return;
            
            const parsedElements = parseHTMLContent(itemHtml, true); // true = isListItem
            const editableTags = ['span', 'strong', 'em', 'b', 'i', 'mark', 'code', 'kbd', 'abbr', 'small', 'sup', 'sub', 'time', 'bdi', 'bdo', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
            
            parsedElements.forEach((parsedElem, idx) => {
                if (parsedElem.type === 'element' && item.elementStyles[parsedElem.id]) {
                    // Знайти відповідний DOM елемент (використовуємо toLowerCase для надійності)
                    const tagNameLower = parsedElem.tagName.toLowerCase();
                    const elementsOfTag = Array.from(liElements[itemIndex].querySelectorAll(tagNameLower));
                    const elementIndex = parsedElements.filter((e, i) => 
                        i < idx && e.type === 'element' && e.tagName === parsedElem.tagName
                    ).length;
                    
                    if (elementsOfTag[elementIndex]) {
                        elementsOfTag[elementIndex].setAttribute('style', item.elementStyles[parsedElem.id]);
                    } else {
                        // Якщо не знайдено, спробувати знайти всі елементи цього типу
                        const allInnerElements = Array.from(liElements[itemIndex].querySelectorAll('*'));
                        const matchingElements = allInnerElements.filter(el => 
                            el.tagName.toLowerCase() === tagNameLower
                        );
                        
                        if (matchingElements[elementIndex]) {
                            matchingElements[elementIndex].setAttribute('style', item.elementStyles[parsedElem.id]);
                        }
                    }
                }
            });
        }
    });
}

// Оновлення атрибута HTML поля в елементі списку
function updateListItemHTMLFieldAttribute(itemIndex, fieldId, attrName, value) {
    if (!currentEditingElement) return;
    
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || elementData.type !== 'list') return;
    
    // Оновити preview
    updateListItemHTMLField(itemIndex, fieldId, '');
}

// Відкрити редактор стилів для елемента списку (li)
function openListItemStyleEditor(listElementId, itemIndex) {
    const elementData = elementDataMap.get(listElementId);
    if (!elementData || elementData.type !== 'list') return;
    
    // Знайти li елемент за індексом
    const listElement = elementData.element;
    if (!listElement) return;
    
    const liElements = listElement.querySelectorAll('li');
    if (itemIndex >= liElements.length) return;
    
    const liElement = liElements[itemIndex];
    
    // Створити тимчасовий elementData для li елемента
    const liElementId = `list-item-${listElementId}-${itemIndex}`;
    const liElementData = {
        element: liElement,
        type: 'list-item',
        parentListId: listElementId,
        itemIndex: itemIndex,
        styles: liElement.getAttribute('style') || ''
    };
    
    // Зберігаємо в тимчасову мапу
    if (!window._listItemDataMap) {
        window._listItemDataMap = new Map();
    }
    window._listItemDataMap.set(liElementId, liElementData);
    
    // Відкрити редактор стилів для li елемента
    openStyleEditor(liElementId, true);
}

// Відкрити редактор стилів для внутрішнього елемента в списку (span, strong і т.д.)
function openListItemElementStyleEditor(listElementId, itemIndex, fieldId) {
    const elementData = elementDataMap.get(listElementId);
    if (!elementData || elementData.type !== 'list') return;
    
    // Знайти li елемент за індексом
    const listElement = elementData.element;
    if (!listElement) return;
    
    const liElements = listElement.querySelectorAll('li');
    if (itemIndex >= liElements.length) return;
    
    const liElement = liElements[itemIndex];
    
    // Знайти внутрішній елемент (span, strong і т.д.) за fieldId
    // Для цього потрібно знайти елемент, який відповідає fieldId
    // Спочатку отримаємо HTML з elementData
    const itemData = elementData.items[itemIndex];
    if (!itemData || typeof itemData !== 'object') return;
    
    const itemHtml = itemData.html || '';
    if (!itemHtml) return;
    
    // Парсимо HTML щоб знайти елемент за fieldId
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${itemHtml}</div>`, 'text/html');
    const container = doc.body.firstChild;
    
    // Знайти елемент за fieldId (використовуємо порядковий номер)
    const parsedElements = parseHTMLContent(itemHtml, true); // true = isListItem
    const targetElement = parsedElements.find(e => e.id === fieldId && e.type === 'element');
    
    if (!targetElement) return;
    
    // Знайти реальний DOM елемент в li
    const editableTags = ['span', 'strong', 'em', 'b', 'i', 'mark', 'code', 'kbd', 'abbr', 'small', 'sup', 'sub', 'time', 'bdi', 'bdo', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const allElements = Array.from(liElement.querySelectorAll(editableTags.join(',')));
    
    // Знайти елемент за тегом і контентом
    let targetDomElement = null;
    let elementIndex = 0;
    for (const elem of allElements) {
        if (elem.tagName.toLowerCase() === targetElement.tagName && 
            elem.textContent.trim() === targetElement.content) {
            // Перевірити чи це правильний елемент за порядком
            const currentIndex = parsedElements.filter(e => 
                e.type === 'element' && 
                e.tagName === targetElement.tagName &&
                parsedElements.indexOf(e) <= parsedElements.indexOf(targetElement)
            ).length - 1;
            
            if (currentIndex === elementIndex) {
                targetDomElement = elem;
                break;
            }
            elementIndex++;
        }
    }
    
    if (!targetDomElement) {
        // Якщо не знайдено, спробувати знайти за порядком
        const elementsOfTag = Array.from(liElement.querySelectorAll(targetElement.tagName));
        const elementIndexInParsed = parsedElements.filter(e => 
            e.type === 'element' && 
            parsedElements.indexOf(e) < parsedElements.indexOf(targetElement)
        ).length;
        
        if (elementsOfTag[elementIndexInParsed]) {
            targetDomElement = elementsOfTag[elementIndexInParsed];
        }
    }
    
    if (!targetDomElement) return;
    
    // Створити тимчасовий elementData для внутрішнього елемента
    const elementElementId = `list-item-element-${listElementId}-${itemIndex}-${fieldId}`;
    const elementElementData = {
        element: targetDomElement,
        type: 'list-item-element',
        parentListId: listElementId,
        itemIndex: itemIndex,
        fieldId: fieldId,
        tagName: targetElement.tagName,
        styles: targetDomElement.getAttribute('style') || targetElement.styles || ''
    };
    
    // Зберігаємо в тимчасову мапу
    if (!window._listItemElementDataMap) {
        window._listItemElementDataMap = new Map();
    }
    window._listItemElementDataMap.set(elementElementId, elementElementData);
    
    // Відкрити редактор стилів для внутрішнього елемента
    openStyleEditor(elementElementId, true, true);
}

// Відкрити редактор стилів
function openStyleEditor(elementId, isListItem = false, isListItemElement = false) {
    let elementData;
    
    if (isListItemElement && window._listItemElementDataMap) {
        elementData = window._listItemElementDataMap.get(elementId);
    } else if (isListItem && window._listItemDataMap) {
        elementData = window._listItemDataMap.get(elementId);
    } else {
        elementData = elementDataMap.get(elementId);
    }
    
    if (!elementData) return;
    
    // Парсимо поточні стилі напряму з елемента (inline стилі)
    const element = elementData.element;
    let currentStyles = element ? (element.getAttribute('style') || '') : (elementData.styles || '');
    let styleObj = parseStyles(currentStyles);
    
    // Якщо немає inline стилів, спробувати отримати з computed styles
    if (!currentStyles && element) {
        const computed = window.getComputedStyle(element);
        // Для color и background-color: получаем из computed, но только если они не прозрачные
        const computedColor = computed.color || '';
        const computedBgColor = computed.backgroundColor || '';
        
        styleObj = {
            'padding-top': computed.paddingTop || '',
            'padding-right': computed.paddingRight || '',
            'padding-bottom': computed.paddingBottom || '',
            'padding-left': computed.paddingLeft || '',
            'margin-top': computed.marginTop || '',
            'margin-right': computed.marginRight || '',
            'margin-bottom': computed.marginBottom || '',
            'margin-left': computed.marginLeft || '',
            'font-size': computed.fontSize || '',
            'font-weight': computed.fontWeight || '',
            'font-style': computed.fontStyle || '',
            'line-height': computed.lineHeight || '',
            'transform': computed.transform || ''
        };
        
        // Добавляем color только если он не прозрачный и не дефолтный черный
        if (computedColor && computedColor !== 'transparent' && computedColor !== 'rgba(0, 0, 0, 0)' && computedColor !== 'rgb(0, 0, 0)') {
            const hexColor = colorToHex(computedColor);
            if (hexColor && hexColor !== '#000000') {
                styleObj.color = hexColor;
            }
        }
        
        // Добавляем background-color только если он не прозрачный
        if (computedBgColor && computedBgColor !== 'transparent' && computedBgColor !== 'rgba(0, 0, 0, 0)') {
            const hexBgColor = colorToHex(computedBgColor);
            if (hexBgColor) {
                styleObj['background-color'] = hexBgColor;
            }
        }
    }
    
    // Зберігаємо всі поточні стилі для збереження невідредагованих
    if (element) {
        elementData._originalStyles = currentStyles;
        elementData._originalStyleObj = { ...styleObj };
    }
    
    // Створюємо попап
    const popup = document.createElement('div');
    popup.id = 'style-editor-popup';
    popup.className = 'style-editor-popup';
    
    // Парсимо padding, margin, transform
    // Використовуємо окремі властивості замість shorthand
    const padding = {
        top: styleObj['padding-top'] || '',
        right: styleObj['padding-right'] || '',
        bottom: styleObj['padding-bottom'] || '',
        left: styleObj['padding-left'] || ''
    };
    // Якщо немає окремих, спробувати розпарсити shorthand
    if (!padding.top && !padding.right && !padding.bottom && !padding.left && styleObj.padding) {
        const parsed = parseSpacing(styleObj.padding);
        padding.top = parsed.top;
        padding.right = parsed.right;
        padding.bottom = parsed.bottom;
        padding.left = parsed.left;
    }
    
    const margin = {
        top: styleObj['margin-top'] || '',
        right: styleObj['margin-right'] || '',
        bottom: styleObj['margin-bottom'] || '',
        left: styleObj['margin-left'] || ''
    };
    // Якщо немає окремих, спробувати розпарсити shorthand
    if (!margin.top && !margin.right && !margin.bottom && !margin.left && styleObj.margin) {
        const parsed = parseSpacing(styleObj.margin);
        margin.top = parsed.top;
        margin.right = parsed.right;
        margin.bottom = parsed.bottom;
        margin.left = parsed.left;
    }
    
    const transform = parseTransform(styleObj.transform || '');
    
    // Парсимо шрифти
    const fontSize = styleObj['font-size'] || '';
    const fontWeight = styleObj['font-weight'] || '';
    const fontStyle = styleObj['font-style'] || '';
    const lineHeight = styleObj['line-height'] || '';
    // Конвертуємо кольори в hex для color picker
    // Для color: если он прозрачный или не задан, не устанавливаем значение
    const originalColor = styleObj.color || '';
    const color = originalColor && originalColor !== 'transparent' && originalColor !== 'rgba(0, 0, 0, 0)' 
        ? colorToHex(originalColor) 
        : '';
    // Сохраняем информацию о том, был ли color задан изначально
    const hasOriginalColor = !!originalColor && originalColor !== 'transparent' && originalColor !== 'rgba(0, 0, 0, 0)';
    
    // Для background-color: если он прозрачный или не задан, не устанавливаем значение
    const originalBackgroundColor = styleObj['background-color'] || '';
    const backgroundColor = originalBackgroundColor && originalBackgroundColor !== 'transparent' && originalBackgroundColor !== 'rgba(0, 0, 0, 0)' 
        ? colorToHex(originalBackgroundColor) 
        : '';
    // Сохраняем информацию о том, был ли background-color задан изначально
    const hasOriginalBackground = !!originalBackgroundColor && originalBackgroundColor !== 'transparent' && originalBackgroundColor !== 'rgba(0, 0, 0, 0)';
    
    // Парсимо розміри
    const width = styleObj.width || '';
    const height = styleObj.height || '';
    const maxWidth = styleObj['max-width'] || '';
    const maxHeight = styleObj['max-height'] || '';
    
    popup.innerHTML = `
        <div class="style-editor-content">
            <div class="style-editor-header">
                <h3><i class="fas fa-paint-brush"></i> Edit Styles</h3>
                <button class="close-style-editor" onclick="closeStyleEditor()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="style-editor-body">
                <div class="style-section">
                    <h4><i class="fas fa-arrows-alt"></i> Padding</h4>
                    <div class="spacing-controls">
                        <div class="spacing-input-group">
                            <label>Top</label>
                            <input type="text" id="style-padding-top" value="${padding.top}" placeholder="0px" />
                            <small class="unit-hint">e.g., 10px, 1em, 2rem</small>
                        </div>
                        <div class="spacing-input-group">
                            <label>Right</label>
                            <input type="text" id="style-padding-right" value="${padding.right}" placeholder="0px" />
                            <small class="unit-hint">e.g., 10px, 1em, 2rem</small>
                        </div>
                        <div class="spacing-input-group">
                            <label>Bottom</label>
                            <input type="text" id="style-padding-bottom" value="${padding.bottom}" placeholder="0px" />
                            <small class="unit-hint">e.g., 10px, 1em, 2rem</small>
                        </div>
                        <div class="spacing-input-group">
                            <label>Left</label>
                            <input type="text" id="style-padding-left" value="${padding.left}" placeholder="0px" />
                            <small class="unit-hint">e.g., 10px, 1em, 2rem</small>
                        </div>
                    </div>
                </div>
                
                <div class="style-section">
                    <h4><i class="fas fa-expand-arrows-alt"></i> Margin</h4>
                    <div class="spacing-controls">
                        <div class="spacing-input-group">
                            <label>Top</label>
                            <input type="text" id="style-margin-top" value="${margin.top}" placeholder="0px" />
                            <small class="unit-hint">e.g., 10px, 1em, 2rem</small>
                        </div>
                        <div class="spacing-input-group">
                            <label>Right</label>
                            <input type="text" id="style-margin-right" value="${margin.right}" placeholder="0px" />
                            <small class="unit-hint">e.g., 10px, 1em, 2rem</small>
                        </div>
                        <div class="spacing-input-group">
                            <label>Bottom</label>
                            <input type="text" id="style-margin-bottom" value="${margin.bottom}" placeholder="0px" />
                            <small class="unit-hint">e.g., 10px, 1em, 2rem</small>
                        </div>
                        <div class="spacing-input-group">
                            <label>Left</label>
                            <input type="text" id="style-margin-left" value="${margin.left}" placeholder="0px" />
                            <small class="unit-hint">e.g., 10px, 1em, 2rem</small>
                        </div>
                    </div>
                </div>
                
                <div class="style-section">
                    <h4><i class="fas fa-sync-alt"></i> Transform</h4>
                    <div class="transform-controls">
                        <div class="transform-input-group">
                            <label>Translate X</label>
                            <input type="text" id="style-transform-x" value="${transform.x}" placeholder="0px" />
                            <small class="unit-hint">e.g., 10px, 1em, 2rem</small>
                        </div>
                        <div class="transform-input-group">
                            <label>Translate Y</label>
                            <input type="text" id="style-transform-y" value="${transform.y}" placeholder="0px" />
                            <small class="unit-hint">e.g., 10px, 1em, 2rem</small>
                        </div>
                        <div class="transform-input-group">
                            <label>Rotate</label>
                            <input type="text" id="style-transform-rotate" value="${transform.rotate}" placeholder="0deg" />
                            <small class="unit-hint">e.g., 45deg, 90deg, 1.5rad</small>
                        </div>
                    </div>
                </div>
                
                <div class="style-section">
                    <h4><i class="fas fa-arrows-alt-h"></i> Size</h4>
                    <div class="size-controls">
                        <div class="size-input-group">
                            <label>Width</label>
                            <input type="text" id="style-width" value="${width}" placeholder="auto" />
                            <small class="unit-hint">e.g., 100px, 50%, auto, 100vw</small>
                        </div>
                        <div class="size-input-group">
                            <label>Height</label>
                            <input type="text" id="style-height" value="${height}" placeholder="auto" />
                            <small class="unit-hint">e.g., 100px, 50%, auto, 100vh</small>
                        </div>
                        <div class="size-input-group">
                            <label>Max Width</label>
                            <input type="text" id="style-max-width" value="${maxWidth}" placeholder="none" />
                            <small class="unit-hint">e.g., 100px, 50%, none, 100vw</small>
                        </div>
                        <div class="size-input-group">
                            <label>Max Height</label>
                            <input type="text" id="style-max-height" value="${maxHeight}" placeholder="none" />
                            <small class="unit-hint">e.g., 100px, 50%, none, 100vh</small>
                        </div>
                    </div>
                </div>
                
                <div class="style-section">
                    <h4><i class="fas fa-font"></i> Font</h4>
                    <div class="font-controls">
                        <div class="font-input-group">
                            <label>Font Size</label>
                            <input type="text" id="style-font-size" value="${fontSize}" placeholder="16px" />
                            <small class="unit-hint">e.g., 16px, 1em, 1.2rem</small>
                        </div>
                        <div class="font-input-group">
                            <label>Font Weight</label>
                            <select id="style-font-weight">
                                <option value="">Normal</option>
                                <option value="100" ${fontWeight === '100' ? 'selected' : ''}>100</option>
                                <option value="200" ${fontWeight === '200' ? 'selected' : ''}>200</option>
                                <option value="300" ${fontWeight === '300' ? 'selected' : ''}>300</option>
                                <option value="400" ${fontWeight === '400' ? 'selected' : ''}>400</option>
                                <option value="500" ${fontWeight === '500' ? 'selected' : ''}>500</option>
                                <option value="600" ${fontWeight === '600' ? 'selected' : ''}>600</option>
                                <option value="700" ${fontWeight === '700' ? 'selected' : ''}>700</option>
                                <option value="800" ${fontWeight === '800' ? 'selected' : ''}>800</option>
                                <option value="900" ${fontWeight === '900' ? 'selected' : ''}>900</option>
                                <option value="bold" ${fontWeight === 'bold' ? 'selected' : ''}>Bold</option>
                            </select>
                        </div>
                        <div class="font-input-group">
                            <label>Font Style</label>
                            <select id="style-font-style">
                                <option value="">Normal</option>
                                <option value="italic" ${fontStyle === 'italic' ? 'selected' : ''}>Italic</option>
                                <option value="oblique" ${fontStyle === 'oblique' ? 'selected' : ''}>Oblique</option>
                            </select>
                        </div>
                        <div class="font-input-group">
                            <label>Line Height</label>
                            <input type="text" id="style-line-height" value="${lineHeight}" placeholder="1.5" />
                            <small class="unit-hint">e.g., 1.5, 24px, 1.5em</small>
                        </div>
                        <div class="font-input-group">
                            <label>Color</label>
                            <input type="color" id="style-color" value="${color || '#000000'}" />
                            <input type="hidden" id="style-color-original" value="${hasOriginalColor ? '1' : '0'}" />
                        </div>
                    </div>
                </div>
                
                <div class="style-section">
                    <h4><i class="fas fa-fill"></i> Background</h4>
                    <div class="background-controls">
                        <div class="background-input-group">
                            <label>Background Color</label>
                            <input type="color" id="style-background-color" value="${backgroundColor || '#000000'}" />
                            <input type="hidden" id="style-background-color-original" value="${hasOriginalBackground ? '1' : '0'}" />
                        </div>
                    </div>
                </div>
            </div>
            <div class="style-editor-actions">
                <button class="btn btn-primary" onclick="applyStyles('${elementId}', ${isListItem}, ${isListItemElement || false})">
                    <i class="fas fa-check"></i> Apply
                </button>
                <button class="btn btn-secondary" onclick="closeStyleEditor()">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Отслеживаем изменения color для определения, был ли он изменен пользователем
    const colorInput = popup.querySelector('#style-color');
    const colorOriginal = popup.querySelector('#style-color-original');
    if (colorInput && colorOriginal) {
        const defaultColorValue = colorInput.value;
        colorInput.addEventListener('change', () => {
            // Если пользователь изменил значение, помечаем что color был установлен
            if (colorInput.value !== defaultColorValue || colorOriginal.value === '1') {
                colorOriginal.value = '1';
            }
            applyStylesPreview(elementId);
        });
        colorInput.addEventListener('input', () => {
            applyStylesPreview(elementId);
        });
    }
    
    // Отслеживаем изменения background-color для определения, был ли он изменен пользователем
    const bgColorInput = popup.querySelector('#style-background-color');
    const bgColorOriginal = popup.querySelector('#style-background-color-original');
    if (bgColorInput && bgColorOriginal) {
        const defaultBgValue = bgColorInput.value;
        bgColorInput.addEventListener('change', () => {
            // Если пользователь изменил значение, помечаем что background-color был установлен
            if (bgColorInput.value !== defaultBgValue || bgColorOriginal.value === '1') {
                bgColorOriginal.value = '1';
            }
            applyStylesPreview(elementId);
        });
        bgColorInput.addEventListener('input', () => {
            applyStylesPreview(elementId);
        });
    }
    
    // Додати обробники для оновлення в реальному часі та стрілок вверх/вниз
    const inputs = popup.querySelectorAll('input, select');
    inputs.forEach(input => {
        if (input.id !== 'style-background-color' && input.id !== 'style-background-color-original' 
            && input.id !== 'style-color' && input.id !== 'style-color-original' && input.type !== 'color') {
            input.addEventListener('input', () => {
                applyStylesPreview(elementId);
            });
            input.addEventListener('change', () => {
                applyStylesPreview(elementId);
            });
            
            // Добавляем обработчик для стрелок вверх/вниз для числовых полей
            if (input.type === 'text') {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        const isUp = e.key === 'ArrowUp';
                        const step = e.shiftKey ? 10 : 1; // Shift + стрелка = шаг 10
                        
                        // Определяем единицу по умолчанию в зависимости от поля
                        let defaultUnit = 'px';
                        if (input.id.includes('rotate')) {
                            defaultUnit = 'deg';
                        }
                        
                        const newValue = adjustNumericValue(input.value, isUp, step, defaultUnit);
                        input.value = newValue;
                        applyStylesPreview(elementId);
                    }
                });
            }
        }
    });
}

// Парсинг числового значения с единицами и увеличение/уменьшение
function adjustNumericValue(value, isUp, step, defaultUnit = 'px') {
    if (!value || value.trim() === '') {
        // Если значение пустое, начинаем с 0
        return `0${defaultUnit}`;
    }
    
    const trimmedValue = value.trim();
    
    // Специальные значения (auto, none и т.д.) не изменяем
    if (trimmedValue === 'auto' || trimmedValue === 'none' || trimmedValue === 'inherit' || trimmedValue === 'initial') {
        return value;
    }
    
    // Парсим значение: число (может быть отрицательным) + единица
    // Поддерживаем форматы: "10", "10px", "10.5em", "-5px", "50%", "1.5" и т.д.
    const match = trimmedValue.match(/^(-?\d*\.?\d+)([a-zA-Z%]*)$/);
    if (!match) {
        // Если не удалось распарсить, возвращаем значение как есть
        return value;
    }
    
    const numValue = parseFloat(match[1]);
    if (isNaN(numValue)) {
        return value;
    }
    
    // Определяем единицу: если она есть в значении, используем её, иначе defaultUnit
    const unit = match[2] || defaultUnit;
    
    // Вычисляем новое значение
    const newNumValue = isUp ? numValue + step : numValue - step;
    
    // Форматируем: убираем лишние нули после запятой
    let formattedValue;
    if (newNumValue % 1 === 0) {
        formattedValue = newNumValue.toString();
    } else {
        // Округляем до 2 знаков после запятой и убираем лишние нули
        formattedValue = newNumValue.toFixed(2).replace(/\.?0+$/, '');
    }
    
    return formattedValue + unit;
}

// Закрити редактор стилів
function closeStyleEditor() {
    const popup = document.getElementById('style-editor-popup');
    if (popup) {
        popup.remove();
    }
}

// Парсинг стилів з рядка
function parseStyles(styleString) {
    const styles = {};
    if (!styleString) return styles;
    
    styleString.split(';').forEach(rule => {
        const [key, value] = rule.split(':').map(s => s.trim());
        if (key && value) {
            styles[key] = value;
        }
    });
    
    // Якщо є shorthand margin, розпарсити його на окремі властивості
    if (styles.margin && !styles['margin-top'] && !styles['margin-right'] && !styles['margin-bottom'] && !styles['margin-left']) {
        const parsed = parseSpacing(styles.margin);
        if (parsed.top) styles['margin-top'] = parsed.top;
        if (parsed.right) styles['margin-right'] = parsed.right;
        if (parsed.bottom) styles['margin-bottom'] = parsed.bottom;
        if (parsed.left) styles['margin-left'] = parsed.left;
        delete styles.margin;
    }
    
    // Якщо є shorthand padding, розпарсити його на окремі властивості
    if (styles.padding && !styles['padding-top'] && !styles['padding-right'] && !styles['padding-bottom'] && !styles['padding-left']) {
        const parsed = parseSpacing(styles.padding);
        if (parsed.top) styles['padding-top'] = parsed.top;
        if (parsed.right) styles['padding-right'] = parsed.right;
        if (parsed.bottom) styles['padding-bottom'] = parsed.bottom;
        if (parsed.left) styles['padding-left'] = parsed.left;
        delete styles.padding;
    }
    
    return styles;
}

// Конвертація кольору з rgba/rgb в hex
function colorToHex(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
        return '';
    }
    
    // Якщо вже hex формат
    if (color.startsWith('#')) {
        return color;
    }
    
    // Конвертація rgb/rgba в hex
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
        const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
        const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
    
    // Якщо назва кольору (black, white, etc), спробувати отримати через canvas
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = color;
    const hex = ctx.fillStyle;
    return hex.startsWith('#') ? hex : '#000000';
}

// Парсинг spacing значень (padding, margin)
function parseSpacing(value) {
    if (!value || value.trim() === '') {
        return { top: '', right: '', bottom: '', left: '' };
    }
    
    // Обробити значення типу "0 0 0 0" або "0px 0px 0px 0px"
    const parts = value.trim().split(/\s+/).filter(p => p);
    
    if (parts.length === 0) {
        return { top: '', right: '', bottom: '', left: '' };
    } else if (parts.length === 1) {
        return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    } else if (parts.length === 2) {
        return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    } else if (parts.length === 3) {
        return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    } else {
        return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    }
}

// Парсинг transform значень (translateX, translateY, rotate)
function parseTransform(value) {
    const result = { x: '', y: '', rotate: '' };
    
    if (!value || !value.trim()) {
        return result;
    }
    
    // Парсимо translateX
    const translateXMatch = value.match(/translateX\(([^)]+)\)/);
    if (translateXMatch) {
        result.x = translateXMatch[1].trim();
    }
    
    // Парсимо translateY
    const translateYMatch = value.match(/translateY\(([^)]+)\)/);
    if (translateYMatch) {
        result.y = translateYMatch[1].trim();
    }
    
    // Парсимо translate(x, y)
    const translateMatch = value.match(/translate\(([^,]+),?\s*([^)]*)\)/);
    if (translateMatch) {
        result.x = translateMatch[1].trim();
        if (translateMatch[2]) {
            result.y = translateMatch[2].trim();
        }
    }
    
    // Парсимо rotate
    const rotateMatch = value.match(/rotate\(([^)]+)\)/);
    if (rotateMatch) {
        result.rotate = rotateMatch[1].trim();
    }
    
    return result;
}

// Застосувати стилі (preview)
function applyStylesPreview(elementId) {
    const elementData = elementDataMap.get(elementId);
    if (!elementData || !elementData.element) return;
    
    const styles = collectStylesFromEditor();
    const styleString = buildStyleString(styles);
    
    elementData.element.setAttribute('style', styleString);
}

// Застосувати стилі (зберегти)
function applyStyles(elementId, isListItem = false, isListItemElement = false) {
    let elementData;
    
    if (isListItemElement && window._listItemElementDataMap) {
        elementData = window._listItemElementDataMap.get(elementId);
    } else if (isListItem && window._listItemDataMap) {
        elementData = window._listItemDataMap.get(elementId);
    } else {
        elementData = elementDataMap.get(elementId);
    }
    
    if (!elementData) return;
    
    // Зібрати нові стилі з редактора
    const newStyles = collectStylesFromEditor();
    
    // Отримати початкові стилі (якщо є)
    const originalStyleObj = elementData._originalStyleObj || {};
    
    // Об'єднати: спочатку початкові стилі, потім нові (нові перезаписують)
    const mergedStyles = { ...originalStyleObj, ...newStyles };
    
    // Побудувати рядок стилів
    const styleString = buildStyleString(mergedStyles);
    
    // Зберегти
    if (isListItemElement && elementData.parentListId) {
        // Для внутрішніх елементів списку (span, strong і т.д.)
        const parentListData = elementDataMap.get(elementData.parentListId);
        if (parentListData && parentListData.items) {
            const itemIndex = elementData.itemIndex;
            const itemData = parentListData.items[itemIndex];
            
            if (itemData && typeof itemData === 'object') {
                // Зберігаємо стилі для конкретного елемента
                if (!itemData.elementStyles) {
                    itemData.elementStyles = {};
                }
                itemData.elementStyles[elementData.fieldId] = styleString;
                
                // Оновити preview для цього елемента списку
                if (currentEditingElement === elementData.parentListId) {
                    // Якщо сайдбар редагування відкритий, оновити preview
                    const itemContainer = document.querySelector(`.list-item-html-fields[data-item-index="${itemIndex}"]`);
                    if (itemContainer) {
                        // Перебудувати HTML з урахуванням нових стилів
                        const allFields = [];
                        itemContainer.querySelectorAll('.html-field-item').forEach(item => {
                            const id = item.dataset.fieldId;
                            const input = item.querySelector('.html-field-input');
                            if (input) {
                                const fieldItem = {
                                    type: item.classList.contains('html-element-item') ? 'element' : 'text',
                                    content: input.value
                                };
                                
                                if (fieldItem.type === 'element') {
                                    fieldItem.tagName = item.dataset.tagName || 'span';
                                    fieldItem.attributes = {};
                                    item.querySelectorAll('.html-field-attr').forEach(attrInput => {
                                        const attrName = attrInput.dataset.attr;
                                        fieldItem.attributes[attrName] = attrInput.value;
                                    });
                                }
                                
                                allFields.push(fieldItem);
                            }
                        });
                        
                        const html = buildHTMLFromFields(allFields, itemData.elementStyles || {});
                        updateListPreview(itemIndex, html, true);
                    }
                }
            }
        }
    } else if (isListItem && elementData.parentListId) {
        // Для елементів списку (li) зберігаємо стилі в elementData батьківського списку
        const parentListData = elementDataMap.get(elementData.parentListId);
        if (parentListData && parentListData.items) {
            const itemIndex = elementData.itemIndex;
            if (!parentListData.items[itemIndex].styles) {
                parentListData.items[itemIndex].styles = {};
            }
            parentListData.items[itemIndex].styles = styleString;
        }
    } else {
        elementData.styles = styleString;
    }
    
    if (elementData.element) {
        elementData.element.setAttribute('style', styleString);
    }
    
    // Очистити тимчасові дані
    delete elementData._originalStyles;
    delete elementData._originalStyleObj;
    
    if (isListItemElement && window._listItemElementDataMap) {
        window._listItemElementDataMap.delete(elementId);
    } else if (isListItem && window._listItemDataMap) {
        window._listItemDataMap.delete(elementId);
    }
    
    closeStyleEditor();
}

// Зібрати стилі з редактора
function collectStylesFromEditor() {
    const styles = {};
    
    // Padding - використовуємо окремі властивості замість shorthand
    const paddingTop = document.getElementById('style-padding-top')?.value.trim() || '';
    const paddingRight = document.getElementById('style-padding-right')?.value.trim() || '';
    const paddingBottom = document.getElementById('style-padding-bottom')?.value.trim() || '';
    const paddingLeft = document.getElementById('style-padding-left')?.value.trim() || '';
    
    if (paddingTop) {
        styles['padding-top'] = paddingTop;
    }
    if (paddingRight) {
        styles['padding-right'] = paddingRight;
    }
    if (paddingBottom) {
        styles['padding-bottom'] = paddingBottom;
    }
    if (paddingLeft) {
        styles['padding-left'] = paddingLeft;
    }
    
    // Margin - використовуємо окремі властивості замість shorthand
    const marginTop = document.getElementById('style-margin-top')?.value.trim() || '';
    const marginRight = document.getElementById('style-margin-right')?.value.trim() || '';
    const marginBottom = document.getElementById('style-margin-bottom')?.value.trim() || '';
    const marginLeft = document.getElementById('style-margin-left')?.value.trim() || '';
    
    if (marginTop) {
        styles['margin-top'] = marginTop;
    }
    if (marginRight) {
        styles['margin-right'] = marginRight;
    }
    if (marginBottom) {
        styles['margin-bottom'] = marginBottom;
    }
    if (marginLeft) {
        styles['margin-left'] = marginLeft;
    }
    
    // Transform
    const transformX = document.getElementById('style-transform-x')?.value.trim() || '';
    const transformY = document.getElementById('style-transform-y')?.value.trim() || '';
    const transformRotate = document.getElementById('style-transform-rotate')?.value.trim() || '';
    
    const transformParts = [];
    if (transformX) {
        transformParts.push(`translateX(${transformX})`);
    }
    if (transformY) {
        transformParts.push(`translateY(${transformY})`);
    }
    if (transformRotate) {
        transformParts.push(`rotate(${transformRotate})`);
    }
    
    if (transformParts.length > 0) {
        styles.transform = transformParts.join(' ');
    }
    
    // Font
    const fontSize = document.getElementById('style-font-size')?.value.trim() || '';
    if (fontSize) {
        styles['font-size'] = fontSize;
    }
    
    const fontWeight = document.getElementById('style-font-weight')?.value || '';
    if (fontWeight) {
        styles['font-weight'] = fontWeight;
    }
    
    const fontStyle = document.getElementById('style-font-style')?.value || '';
    if (fontStyle) {
        styles['font-style'] = fontStyle;
    }
    
    const lineHeight = document.getElementById('style-line-height')?.value.trim() || '';
    if (lineHeight) {
        styles['line-height'] = lineHeight;
    }
    
    // Color - добавляем только если он был задан изначально или изменен пользователем
    const color = document.getElementById('style-color')?.value || '';
    const hadOriginalColor = document.getElementById('style-color-original')?.value === '1';
    
    // Добавляем color только если:
    // 1. Он был задан изначально, ИЛИ
    // 2. Пользователь явно установил значение (не дефолтное #000000)
    if (color && (hadOriginalColor || color !== '#000000')) {
        styles.color = color;
    }
    
    // Background - добавляем только если он был задан изначально или изменен пользователем
    const backgroundColor = document.getElementById('style-background-color')?.value || '';
    const hadOriginalBackground = document.getElementById('style-background-color-original')?.value === '1';
    
    // Добавляем background-color только если:
    // 1. Он был задан изначально, ИЛИ
    // 2. Пользователь явно установил значение (не дефолтное #000000)
    if (backgroundColor && (hadOriginalBackground || backgroundColor !== '#000000')) {
        styles['background-color'] = backgroundColor;
    }
    
    // Size
    const width = document.getElementById('style-width')?.value.trim() || '';
    if (width) {
        styles.width = width;
    }
    
    const height = document.getElementById('style-height')?.value.trim() || '';
    if (height) {
        styles.height = height;
    }
    
    const maxWidth = document.getElementById('style-max-width')?.value.trim() || '';
    if (maxWidth) {
        styles['max-width'] = maxWidth;
    }
    
    const maxHeight = document.getElementById('style-max-height')?.value.trim() || '';
    if (maxHeight) {
        styles['max-height'] = maxHeight;
    }
    
    return styles;
}

// Побудувати рядок стилів
function buildStyleString(styles) {
    return Object.keys(styles)
        .map(key => `${key}: ${styles[key]}`)
        .join('; ');
}

function updateElementPreview(type, value, useHTML = false) {
   
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || !elementData.element) return;

    if (type === 'text') {
        if (useHTML) {
            // Використовуємо innerHTML для збереження HTML структури
            // Заменяем переносы строк на <br> перед установкой
            let htmlValue = value;
            if (htmlValue && htmlValue.includes('\n')) {
                htmlValue = htmlValue.replace(/\n/g, '<br>');
            }
            elementData.element.innerHTML = htmlValue;
        } else {
            // Використовуємо innerHTML для простого тексту (чтобы поддерживать <br>)
            // Заменяем переносы строк на <br> перед установкой
            let htmlValue = value;
            if (htmlValue && htmlValue.includes('\n')) {
                htmlValue = htmlValue.replace(/\n/g, '<br>');
            }
            elementData.element.innerHTML = htmlValue;
        }
    } else if (type === 'input' || type === 'textarea') {
        elementData.element.value = value;
        if (type === 'input') {
            elementData.element.setAttribute('value', value);
        }
    } else if (type === 'select') {
        elementData.element.value = value;
        Array.from(elementData.element.options).forEach(opt => {
            if (opt.value === value) {
                opt.selected = true;
                opt.setAttribute('selected', 'selected');
            } else {
                opt.selected = false;
                opt.removeAttribute('selected');
            }
        });
    } else if (type === 'image') {
        // Оновлення зображення (src, alt, title)
        if (elementData.element) {
            if (value.src !== undefined) {
                elementData.element.src = value.src;
            }
            if (value.alt !== undefined) {
                elementData.element.alt = value.alt;
            }
            if (value.title !== undefined) {
                if (value.title) {
                    elementData.element.setAttribute('title', value.title);
                } else {
                    elementData.element.removeAttribute('title');
                }
            }
        }
    }
}

// Оновити попередній перегляд списку
function updateListPreview(index, value, isHtml = false) {
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || elementData.type !== 'list' || !elementData.element) return;

    const items = Array.from(elementData.element.querySelectorAll('li'));
    if (items[index]) {
        if (isHtml) {
            items[index].innerHTML = value;
            
            // Застосувати стилі для внутрішніх елементів після оновлення HTML
            const itemData = elementData.items[index];
            if (itemData && typeof itemData === 'object' && itemData.elementStyles) {
                const elementStyles = itemData.elementStyles;
                const parsedElements = parseHTMLContent(value, true); // true = isListItem
                
                parsedElements.forEach((parsedElem, idx) => {
                    if (parsedElem.type === 'element' && elementStyles[parsedElem.id]) {
                        const tagNameLower = parsedElem.tagName.toLowerCase();
                        const elementsOfTag = Array.from(items[index].querySelectorAll(tagNameLower));
                        const elementIndex = parsedElements.filter((e, i) => 
                            i < idx && e.type === 'element' && e.tagName === parsedElem.tagName
                        ).length;
                        
                        if (elementsOfTag[elementIndex]) {
                            elementsOfTag[elementIndex].setAttribute('style', elementStyles[parsedElem.id]);
                        } else {
                            // Якщо не знайдено, спробувати знайти всі елементи цього типу
                            const allInnerElements = Array.from(items[index].querySelectorAll('*'));
                            const matchingElements = allInnerElements.filter(el => 
                                el.tagName.toLowerCase() === tagNameLower
                            );
                            
                            if (matchingElements[elementIndex]) {
                                matchingElements[elementIndex].setAttribute('style', elementStyles[parsedElem.id]);
                            }
                        }
                    }
                });
            }
            
            // Оновити elementData.items
            if (elementData.items[index]) {
                elementData.items[index].html = value;
                elementData.items[index].text = items[index].textContent.trim();
            } else {
                elementData.items[index] = {
                    text: items[index].textContent.trim(),
                    html: value,
                    hasHtml: true
                };
            }
        } else {
            items[index].textContent = value;
            // Оновити elementData.items
            if (elementData.items[index] && typeof elementData.items[index] === 'object') {
                elementData.items[index].text = value;
            } else {
                elementData.items[index] = value;
            }
        }
    }
}

// Додати опцію до select
function addOption() {
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || elementData.type !== 'select') return;

    const optionsList = document.getElementById('options-list');
    const index = elementData.options.length;
    
    const optionDiv = document.createElement('div');
    optionDiv.className = 'option-item';
    optionDiv.innerHTML = `
        <div class="option-inputs">
            <div class="option-input-group">
                <label>Text</label>
                <input type="text" class="option-text" value="New option" data-option-index="${index}" oninput="updateOptionPreview(${index}, 'text', this.value)" placeholder="Option text" />
            </div>
            <div class="option-input-group">
                <label>Value</label>
                <input type="text" class="option-value" value="new-option-${index}" data-option-index="${index}" oninput="updateOptionPreview(${index}, 'value', this.value)" placeholder="Option value" />
            </div>
        </div>
        <button type="button" class="btn-remove-option" onclick="removeOption(${index})" title="Remove option">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    optionsList.appendChild(optionDiv);
    
    elementData.options.push({
        value: `new-option-${index}`,
                text: 'New option',
        selected: false,
    });

    // Оновити select в preview
    const option = document.createElement('option');
    option.value = `new-option-${index}`;
        option.textContent = 'New option';
    elementData.element.appendChild(option);
    
    // Оновити select в сайдбарі
    const select = document.getElementById('edit-select-value');
    if (select) {
        const newOption = document.createElement('option');
        newOption.value = `new-option-${index}`;
        newOption.textContent = 'New option';
        select.appendChild(newOption);
    }
}

// Оновити опцію в preview
function updateOptionPreview(index, field, value) {
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || elementData.type !== 'select') return;

    const selectElement = elementData.element;
    const options = Array.from(selectElement.options);
    
    if (options[index]) {
        if (field === 'text') {
            options[index].textContent = value;
            elementData.options[index].text = value;
        } else if (field === 'value') {
            options[index].value = value;
            elementData.options[index].value = value;
        }
    }
    
    // Оновити select в сайдбарі
    const sidebarSelect = document.getElementById('edit-select-value');
    if (sidebarSelect) {
        const sidebarOptions = Array.from(sidebarSelect.options);
        if (sidebarOptions[index]) {
            if (field === 'text') {
                sidebarOptions[index].textContent = value;
            } else if (field === 'value') {
                sidebarOptions[index].value = value;
            }
        }
    }
}

// Видалити опцію з select
function removeOption(index) {
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || elementData.type !== 'select') return;

    if (elementData.options.length <= 1) {
        alert('Cannot remove the last option');
        return;
    }

    elementData.options.splice(index, 1);
    
    // Оновити DOM
    const optionsList = document.getElementById('options-list');
    optionsList.innerHTML = elementData.options.map((opt, idx) => `
        <div class="option-item">
            <div class="option-inputs">
                <div class="option-input-group">
                    <label>Text</label>
                    <input type="text" class="option-text" value="${escapeHtml(opt.text)}" data-option-index="${idx}" oninput="updateOptionPreview(${idx}, 'text', this.value)" placeholder="Option text" />
                </div>
                <div class="option-input-group">
                    <label>Value</label>
                    <input type="text" class="option-value" value="${escapeHtml(opt.value)}" data-option-index="${idx}" oninput="updateOptionPreview(${idx}, 'value', this.value)" placeholder="Option value" />
                </div>
            </div>
            <button type="button" class="btn-remove-option" onclick="removeOption(${idx})" title="Remove option">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    // Оновити select в preview
    const selectElement = elementData.element;
    const options = Array.from(selectElement.options);
    if (options[index]) {
        selectElement.removeChild(options[index]);
    }
    
    // Оновити select в сайдбарі
    const sidebarSelect = document.getElementById('edit-select-value');
    if (sidebarSelect) {
        const sidebarOptions = Array.from(sidebarSelect.options);
        if (sidebarOptions[index]) {
            sidebarSelect.removeChild(sidebarOptions[index]);
        }
    }
}

// Додати пункт до списку
function addListItem() {
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || elementData.type !== 'list') return;

    const hasHtmlItems = elementData.hasHtmlItems || false;
    const index = elementData.items.length;
    
    // Отримати останній елемент для копіювання
    let lastItem = null;
    if (elementData.items.length > 0) {
        lastItem = elementData.items[elementData.items.length - 1];
    }
    
    // Додати новий елемент до elementData.items (копія останнього або новий)
    if (hasHtmlItems) {
        if (lastItem && typeof lastItem === 'object') {
            elementData.items.push({
                text: lastItem.text || 'New item',
                html: lastItem.html || 'New item',
                hasHtml: lastItem.hasHtml || false,
                styles: lastItem.styles || '',
                elementStyles: lastItem.elementStyles ? {...lastItem.elementStyles} : {}
            });
        } else {
            elementData.items.push({
                text: 'New item',
                html: 'New item',
                hasHtml: false,
                styles: '',
                elementStyles: {}
            });
        }
    } else {
        const lastItemText = lastItem ? (typeof lastItem === 'string' ? lastItem : lastItem.text || 'New item') : 'New item';
        const lastItemStyles = lastItem && typeof lastItem === 'object' ? (lastItem.styles || '') : '';
        if (lastItemStyles) {
            elementData.items.push({
                text: lastItemText,
                styles: lastItemStyles
            });
        } else {
            elementData.items.push(lastItemText);
        }
    }

    const listItems = document.getElementById('list-items');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'list-item';
    itemDiv.setAttribute('data-item-index', index);
    
    if (hasHtmlItems) {
        // Якщо є HTML, створюємо окремі поля (копія останнього або новий)
        const itemHtml = lastItem && typeof lastItem === 'object' ? (lastItem.html || lastItem.text || 'New item') : 'New item';
        const parsedElements = parseHTMLContent(itemHtml, true); // true = isListItem
        
        // Зберігаємо originalHtml з маркерами
        const markedHtml = parsedElements[0]?.originalHtml || itemHtml;
        
        let fieldsHTML = '';
        parsedElements.forEach((elem) => {
            if (elem.type === 'text') {
                // Використовуємо textarea для всіх текстових полів, щоб зберегти форматирование
                fieldsHTML += `
                    <div class="html-field-item" data-field-id="${elem.id}" data-item-index="${index}">
                        <label style="font-size: 10px; color: var(--text-secondary); margin-bottom: 3px; display: block;">
                            <i class="fas fa-font"></i> Text
                        </label>
                        <textarea class="html-field-input list-item-html-field" data-field-id="${elem.id}" data-item-index="${index}" rows="2" placeholder="Enter text... (use Enter for line breaks)" oninput="updateListItemHTMLField('${index}', '${elem.id}', this.value)">${escapeHtml(elem.content)}</textarea>
                    </div>
                `;
                } else if (elem.type === 'element') {
                    const tagIcon = getTagIcon(elem.tagName);
                    const tagLabel = getElementTypeLabel(elem.tagName);
                    fieldsHTML += `
                        <div class="html-field-item html-element-item" data-field-id="${elem.id}" data-item-index="${index}" data-tag-name="${elem.tagName}">
                            <label style="font-size: 10px; color: var(--text-secondary); font-weight: 600; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                                <i class="${tagIcon}"></i> ${tagLabel} (&lt;${elem.tagName}&gt;)
                            </label>
                            <textarea class="html-field-input list-item-html-field" 
                                   data-field-id="${elem.id}" 
                                   data-item-index="${index}"
                                   rows="2"
                                   placeholder="Enter ${tagLabel.toLowerCase()} content... (use Enter for line breaks)" 
                                   oninput="updateListItemHTMLField('${index}', '${elem.id}', this.value)">${escapeHtml(elem.content)}</textarea>
                    </div>
                `;
                }
        });
        
        itemDiv.className = 'list-item list-item-with-html';
        itemDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Item ${index + 1}</label>
                <div style="display: flex; gap: 4px;">
                    <button type="button" class="btn-edit-item-styles" onclick="openListItemStyleEditor('${currentEditingElement}', ${index})" title="Edit item styles" style="padding: 4px 8px; font-size: 11px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-paint-brush"></i>
                    </button>
                    <button type="button" class="btn-remove-item" onclick="removeListItem(${index})" title="Remove item">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="list-item-html-fields" data-item-index="${index}">
                ${fieldsHTML}
            </div>
            <textarea class="list-item-html-value" data-item-index="${index}" style="display: none;">${escapeHtml(markedHtml)}</textarea>
            <textarea class="list-item-html-original" data-item-index="${index}" style="display: none;">${escapeHtml(markedHtml)}</textarea>
        `;
        listItems.appendChild(itemDiv);
    } else {
        // Якщо немає HTML, використовуємо простий input
        itemDiv.innerHTML = `
            <input type="text" class="list-item-input" value="New item" data-item-index="${index}" placeholder="List item" />
            <button type="button" class="btn-remove-item" onclick="removeListItem(${index})" title="Remove item">
                <i class="fas fa-trash"></i>
            </button>
        `;
        listItems.appendChild(itemDiv);
        
        // Додати обробник події
        const input = itemDiv.querySelector('.list-item-input');
        if (input) {
            input.addEventListener('input', () => {
                updateListPreview(index, input.value, false);
            });
        }
    }

    // Оновити список в preview
    const li = document.createElement('li');
    if (hasHtmlItems && lastItem && typeof lastItem === 'object') {
        li.innerHTML = lastItem.html || lastItem.text || 'New item';
        if (lastItem.styles) {
            li.setAttribute('style', lastItem.styles);
        }
        // Застосувати стилі для внутрішніх елементів
        if (lastItem.elementStyles) {
            const editableTags = ['span', 'strong', 'em', 'b', 'i', 'mark', 'code', 'kbd', 'abbr', 'small', 'sup', 'sub', 'time', 'bdi', 'bdo', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
            const itemHtml = lastItem.html || '';
            if (itemHtml) {
                const parsedElements = parseHTMLContent(itemHtml, true); // true = isListItem
                parsedElements.forEach((parsedElem, idx) => {
                    if (parsedElem.type === 'element' && lastItem.elementStyles[parsedElem.id]) {
                        const elementsOfTag = Array.from(li.querySelectorAll(parsedElem.tagName));
                        const elementIndex = parsedElements.filter((e, i) => 
                            i < idx && e.type === 'element' && e.tagName === parsedElem.tagName
                        ).length;
                        if (elementsOfTag[elementIndex]) {
                            elementsOfTag[elementIndex].setAttribute('style', lastItem.elementStyles[parsedElem.id]);
                        }
                    }
                });
            }
        }
    } else {
        const lastItemText = lastItem ? (typeof lastItem === 'string' ? lastItem : lastItem.text || 'New item') : 'New item';
        li.textContent = lastItemText;
        if (lastItem && typeof lastItem === 'object' && lastItem.styles) {
            li.setAttribute('style', lastItem.styles);
        }
    }
    elementData.element.appendChild(li);
}

// Видалити пункт зі списку
function removeListItem(index) {
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData || elementData.type !== 'list') return;

    const hasHtmlItems = elementData.hasHtmlItems || false;

    elementData.items.splice(index, 1);

    // Оновити DOM
    const listItems = document.getElementById('list-items');
    if (hasHtmlItems) {
        // Перегенерувати HTML для списку з HTML полів
        let itemsHTML = elementData.items.map((item, idx) => {
            const itemHtml = item.html || item.text || '';
            const parsedElements = parseHTMLContent(itemHtml, true); // true = isListItem
            
            let fieldsHTML = '';
            parsedElements.forEach((elem) => {
                if (elem.type === 'text') {
                    // Використовуємо textarea для всіх текстових полів, щоб зберегти форматирование
                    fieldsHTML += `
                        <div class="html-field-item" data-field-id="${elem.id}" data-item-index="${idx}">
                            <label style="font-size: 10px; color: var(--text-secondary); margin-bottom: 3px; display: block;">
                                <i class="fas fa-font"></i> Text
                            </label>
                            <textarea class="html-field-input list-item-html-field" data-field-id="${elem.id}" data-item-index="${idx}" rows="2" placeholder="Enter text... (use Enter for line breaks)" oninput="updateListItemHTMLField('${idx}', '${elem.id}', this.value)">${escapeHtml(elem.content)}</textarea>
                        </div>
                    `;
                } else if (elem.type === 'element') {
                    const tagIcon = getTagIcon(elem.tagName);
                    const tagLabel = getElementTypeLabel(elem.tagName);
                    fieldsHTML += `
                        <div class="html-field-item html-element-item" data-field-id="${elem.id}" data-item-index="${idx}" data-tag-name="${elem.tagName}">
                            <label style="font-size: 10px; color: var(--text-secondary); font-weight: 600; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                                <i class="${tagIcon}"></i> ${tagLabel} (&lt;${elem.tagName}&gt;)
                            </label>
                            <textarea class="html-field-input list-item-html-field" 
                                   data-field-id="${elem.id}" 
                                   data-item-index="${idx}"
                                   rows="2"
                                   placeholder="Enter ${tagLabel.toLowerCase()} content... (use Enter for line breaks)" 
                                   oninput="updateListItemHTMLField('${idx}', '${elem.id}', this.value)">${escapeHtml(elem.content)}</textarea>
                            ${elem.tagName === 'a' && elem.attributes.href ? `
                                <input type="text" class="html-field-attr list-item-html-field" 
                                       data-field-id="${elem.id}" 
                                       data-item-index="${idx}"
                                       data-attr="href" 
                                       value="${escapeHtml(elem.attributes.href)}" 
                                       placeholder="URL (href)" 
                                       style="margin-top: 4px;"
                                       oninput="updateListItemHTMLFieldAttribute('${idx}', '${elem.id}', 'href', this.value)" />
                            ` : ''}
                            ${elem.tagName === 'abbr' && elem.attributes.title ? `
                                <input type="text" class="html-field-attr list-item-html-field" 
                                       data-field-id="${elem.id}" 
                                       data-item-index="${idx}"
                                       data-attr="title" 
                                       value="${escapeHtml(elem.attributes.title)}" 
                                       placeholder="Full name (title)" 
                                       style="margin-top: 4px;"
                                       oninput="updateListItemHTMLFieldAttribute('${idx}', '${elem.id}', 'title', this.value)" />
                            ` : ''}
                        </div>
                    `;
                }
            });
            
            return `
                <div class="list-item list-item-with-html" data-item-index="${idx}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Item ${idx + 1}</label>
                        <button type="button" class="btn-remove-item" onclick="removeListItem(${idx})" title="Remove item">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="list-item-html-fields" data-item-index="${idx}">
                        ${fieldsHTML}
                    </div>
                    <textarea class="list-item-html-value" data-item-index="${idx}" style="display: none;">${escapeHtml(itemHtml)}</textarea>
                    <textarea class="list-item-html-original" data-item-index="${idx}" style="display: none;">${escapeHtml(itemHtml)}</textarea>
                </div>
            `;
        }).join('');
        listItems.innerHTML = itemsHTML;
        // Додати клас до контейнера
        if (hasHtmlItems) {
            listItems.classList.add('list-with-html');
        } else {
            listItems.classList.remove('list-with-html');
        }
    } else {
        // Прості input поля
        listItems.innerHTML = elementData.items.map((item, idx) => {
            const itemText = typeof item === 'string' ? item : (item.text || '');
            return `
                <div class="list-item">
                    <input type="text" class="list-item-input" value="${escapeHtml(itemText)}" data-item-index="${idx}" placeholder="List item" />
                    <button type="button" class="btn-remove-item" onclick="removeListItem(${idx})" title="Remove item">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        // Переконатися, що клас не додано для простого списку
        listItems.classList.remove('list-with-html');
        
        // Додати обробники подій
        const inputs = listItems.querySelectorAll('.list-item-input');
        inputs.forEach((input, idx) => {
            input.addEventListener('input', () => {
                updateListPreview(idx, input.value, false);
            });
        });
    }

    // Оновити список в preview
    const listElement = elementData.element;
    const items = Array.from(listElement.querySelectorAll('li'));
    if (items[index]) {
        listElement.removeChild(items[index]);
    }
}

// Зберегти редагування
async function saveEdit() {
    const elementData = elementDataMap.get(currentEditingElement);
    if (!elementData) return;

    let editData = {
        selector: elementData.selector,
        type: elementData.type,
        dataId: elementData.element?.dataset?.editId || '',
    };

    if (elementData.type === 'text') {
        const hasChildren = elementData.hasChildren || false;
        let contentValue = '';
        
        // Перевірити чи є HTML поля (новий режим)
        const htmlFieldsContainer = document.getElementById('html-fields-container');
        if (hasChildren && htmlFieldsContainer) {
            // Зібрати дані з HTML полів
            const allFields = [];
            htmlFieldsContainer.querySelectorAll('.html-field-item').forEach(item => {
                const id = item.dataset.fieldId;
                const input = item.querySelector('.html-field-input');
                if (input) {
                    // Сразу заменяем переносы строк на <br> при получении из textarea
                    let content = input.value;
                    if (content.includes('\n')) {
                        content = content.replace(/\n/g, '<br>');
                    }
                    
                    const fieldItem = {
                        type: item.classList.contains('html-element-item') ? 'element' : 'text',
                        content: content
                    };
                    
                    // Зібрати атрибути для елементів
                    if (fieldItem.type === 'element') {
                        // Отримати tagName з data-атрибута (більш надійно)
                        fieldItem.tagName = item.dataset.tagName || item.querySelector('label')?.textContent?.match(/\(&lt;(\w+)&gt;\)/)?.[1] || 'span';
                        fieldItem.attributes = {};
                        item.querySelectorAll('.html-field-attr').forEach(attrInput => {
                            const attrName = attrInput.dataset.attr;
                            fieldItem.attributes[attrName] = attrInput.value;
                        });
                    }
                    
                    allFields.push(fieldItem);
                }
            });
            
            // Отримати originalHtml з textarea (якщо є)
            const textarea = document.getElementById('edit-text-value');
            const originalHtml = textarea ? textarea.value : null;
            
            // Додати originalHtml до першого поля, якщо є
            if (allFields.length > 0 && originalHtml) {
                // Перевірити чи originalHtml містить маркери (коментарі або data-атрибути)
                // Якщо так, використати його
                if (originalHtml.includes('data-edit-field-id') || originalHtml.includes('data-text-nodes-info')) {
                    allFields[0].originalHtml = originalHtml;
                }
            }
            
            // Зібрати HTML з полів
            contentValue = buildHTMLFromFields(allFields);
            // Заменяем переносы строк на <br> в итоговом HTML (на случай, если они остались)
            if (contentValue.includes('\n')) {
                contentValue = contentValue.replace(/\n/g, '<br>');
            }
        } else if (hasChildren && codeEditor) {
            // Старий режим з CodeMirror
            try {
                if (codeEditor && typeof codeEditor.getValue === 'function') {
                    contentValue = codeEditor.getValue();
                    // Заменяем переносы строк на <br> для CodeMirror
                    if (contentValue.includes('\n')) {
                        contentValue = contentValue.replace(/\n/g, '<br>');
                    }
                    console.log('Got from CodeMirror:', contentValue.substring(0, 100));
                    // Оновити textarea для синхронізації
                    const textarea = document.getElementById('edit-text-value');
                    if (textarea) {
                        textarea.value = contentValue;
                    }
                } else {
                    console.warn('CodeMirror does not have getValue method');
                    // Якщо метод недоступний, пробуємо з textarea
                    const textarea = document.getElementById('edit-text-value');
                    if (textarea) {
                        contentValue = textarea.value;
                        // Заменяем переносы строк на <br>
                        if (contentValue.includes('\n')) {
                            contentValue = contentValue.replace(/\n/g, '<br>');
                        }
                        console.log('Got from textarea (fallback):', contentValue.substring(0, 100));
                    }
                }
            } catch (e) {
                console.warn('Error getting value from CodeMirror:', e);
                // Якщо не вдалося, пробуємо з textarea
                const textarea = document.getElementById('edit-text-value');
                if (textarea) {
                    contentValue = textarea.value;
                    // Заменяем переносы строк на <br>
                    if (contentValue.includes('\n')) {
                        contentValue = contentValue.replace(/\n/g, '<br>');
                    }
                    console.log('Got from textarea (error fallback):', contentValue.substring(0, 100));
                }
            }
        } else {
            // Інакше з textarea
            const textarea = document.getElementById('edit-text-value');
            if (textarea) {
                contentValue = textarea.value;
                // Заменяем переносы строк на <br> для простого текста
                if (contentValue.includes('\n')) {
                    contentValue = contentValue.replace(/\n/g, '<br>');
                }
                console.log('contentValue', contentValue);
                console.log('Got from textarea (no CodeMirror):', contentValue.substring(0, 100));
            } else {
                console.warn('Textarea not found!');
            }
        }
        
        // Перевіряємо чи отримали значення
        if (contentValue === undefined || contentValue === null) {
            console.warn('Failed to get value for saving, trying textarea');
            const textarea = document.getElementById('edit-text-value');
            if (textarea) {
                contentValue = textarea.value || '';
                // Заменяем переносы строк на <br> в fallback случае
                if (contentValue.includes('\n')) {
                    contentValue = contentValue.replace(/\n/g, '<br>');
                }
            } else {
                contentValue = '';
            }
        }
        
        console.log('Final value for saving:', {
            hasChildren: hasChildren,
            contentLength: contentValue ? contentValue.length : 0,
            preview: contentValue ? contentValue.substring(0, 50) : ''
        });
        
        // Зберігаємо значення незалежно від того, чи воно порожнє
        // Проверяем, содержит ли contentValue HTML теги (например, <br>)
        const containsHTML = contentValue && (contentValue.includes('<br>') || contentValue.includes('<') && contentValue.includes('>'));
        
        if (hasChildren || containsHTML) {
            // Якщо є дочірні елементи или HTML теги, зберігаємо HTML
            editData.html = contentValue || '';
            editData.hasChildren = true;
            console.log('Saved HTML, length:', editData.html ? editData.html.length : 0);
        } else {
            // Якщо немає дочірніх елементів и HTML тегов, зберігаємо текст
            editData.text = contentValue || '';
            editData.hasChildren = false;
            console.log('Saved text, length:', editData.text ? editData.text.length : 0);
        }
        
        // Зберегти спеціальні атрибути
        if (elementData.tagName === 'a') {
            const hrefInput = document.getElementById('edit-href-value');
            if (hrefInput) {
                editData.href = hrefInput.value;
            }
        }
        
        if (elementData.tagName === 'abbr') {
            const titleInput = document.getElementById('edit-title-value');
            if (titleInput) {
                editData.title = titleInput.value;
            }
        }
        
        if (elementData.tagName === 'time') {
            const datetimeInput = document.getElementById('edit-datetime-value');
            if (datetimeInput) {
                editData.datetime = datetimeInput.value;
            }
        }
        
        if (elementData.tagName === 'bdo') {
            const dirSelect = document.getElementById('edit-dir-value');
            if (dirSelect) {
                editData.dir = dirSelect.value;
            }
        }
        
        // Зберегти інформацію про тег для правильного оновлення
        editData.tagName = elementData.tagName;
        editData.styles = elementData.styles;
        editData.className = elementData.className;
    } else if (elementData.type === 'image') {
        // Зберегти зображення
        const altInput = document.getElementById('edit-image-alt');
        const titleInput = document.getElementById('edit-image-title');
        const widthInput = document.getElementById('edit-image-width');
        const heightInput = document.getElementById('edit-image-height');
        
        editData.src = elementData.element?.src || elementData.src || '';
        editData.alt = altInput ? altInput.value : elementData.alt || '';
        editData.title = titleInput ? titleInput.value : elementData.title || '';
        editData.width = widthInput ? widthInput.value.trim() : elementData.width || '';
        editData.height = heightInput ? heightInput.value.trim() : elementData.height || '';
        editData.tagName = 'img';
        editData.styles = elementData.styles;
        editData.className = elementData.className;
    } else if (elementData.type === 'input') {
        const input = document.getElementById('edit-input-value');
        if (input) {
            editData.value = input.value;
        }
    } else if (elementData.type === 'select') {
        const select = document.getElementById('edit-select-value');
        const options = Array.from(document.querySelectorAll('.option-item'));
        
        const newOptions = options.map(optDiv => {
            const textInput = optDiv.querySelector('.option-text');
            const valueInput = optDiv.querySelector('.option-value');
            return {
                value: valueInput.value,
                text: textInput.value,
                selected: select && select.value === valueInput.value,
            };
        });

        editData.value = select ? select.value : newOptions[0]?.value;
        editData.options = newOptions;
    } else if (elementData.type === 'textarea') {
        const textarea = document.getElementById('edit-textarea-value');
        if (textarea) {
            editData.value = textarea.value;
        }
    } else if (elementData.type === 'list') {
        const hasHtmlItems = elementData.hasHtmlItems || false;
        
        if (hasHtmlItems) {
            // Перевірити чи є HTML поля (новий режим)
            const listItemsWithHTML = document.querySelectorAll('.list-item-with-html');
            if (listItemsWithHTML.length > 0) {
                // Зібрати HTML з полів
                editData.items = Array.from(listItemsWithHTML).map((itemDiv, index) => {
                    const itemIndex = parseInt(itemDiv.dataset.itemIndex);
                    const itemContainer = itemDiv.querySelector('.list-item-html-fields');
                    
                    if (itemContainer) {
                        const allFields = [];
                        itemContainer.querySelectorAll('.html-field-item').forEach(item => {
                            const id = item.dataset.fieldId; // Важливо: зберігаємо id для пошуку по маркерах
                            const input = item.querySelector('.html-field-input');
                            if (input) {
                                // Сразу заменяем переносы строк на <br> при получении из textarea
                                let content = input.value;
                                if (content.includes('\n')) {
                                    content = content.replace(/\n/g, '<br>');
                                }
                                
                                const fieldItem = {
                                    id: id, // Важливо: зберігаємо id для пошуку по маркерах
                                    type: item.classList.contains('html-element-item') ? 'element' : 'text',
                                    content: content
                                };
                                
                                // Зібрати атрибути для елементів
                                if (fieldItem.type === 'element') {
                                    // Отримати tagName з data-атрибута (більш надійно)
                                    fieldItem.tagName = item.dataset.tagName || item.querySelector('label')?.textContent?.match(/\(&lt;(\w+)&gt;\)/)?.[1] || 'span';
                                    fieldItem.attributes = {};
                                    item.querySelectorAll('.html-field-attr').forEach(attrInput => {
                                        const attrName = attrInput.dataset.attr;
                                        fieldItem.attributes[attrName] = attrInput.value;
                                    });
                                }
                                
                                allFields.push(fieldItem);
                            }
                        });
                        
                        // Отримати стилі з elementData
                        const itemIndex = parseInt(itemDiv.dataset.itemIndex);
                        const originalItem = elementData.items[itemIndex];
                        const itemStyles = originalItem && typeof originalItem === 'object' ? (originalItem.styles || '') : '';
                        const elementStyles = (originalItem && typeof originalItem === 'object' && originalItem.elementStyles) ? originalItem.elementStyles : {};
                        
                        // Отримати originalHtml з скритого textarea (там зберігається HTML з маркерами)
                        const originalTextarea = itemDiv.querySelector('.list-item-html-original');
                        const originalHtml = originalTextarea ? originalTextarea.value : null;
                        
                        // Додати originalHtml до першого поля, якщо є
                        if (allFields.length > 0 && originalHtml) {
                            allFields[0].originalHtml = originalHtml;
                        } else if (allFields.length > 0 && !originalHtml) {
                            // Якщо немає originalHtml, спробувати отримати з основного textarea
                            const mainTextarea = itemDiv.querySelector('.list-item-html-value');
                            if (mainTextarea && mainTextarea.value) {
                                // Перевірити чи містить маркери
                                const htmlValue = mainTextarea.value;
                                if (htmlValue.includes('data-edit-field-id') || htmlValue.includes('data-text-nodes-info')) {
                                    allFields[0].originalHtml = htmlValue;
                                }
                            }
                        }
                        
                        let html = buildHTMLFromFields(allFields, elementStyles);
                        // Заменяем переносы строк на <br> в итоговом HTML (на случай, если они остались)
                        if (html.includes('\n')) {
                            html = html.replace(/\n/g, '<br>');
                        }
                        const textarea = itemDiv.querySelector('.list-item-html-value');
                        if (textarea) {
                            textarea.value = html;
                        }
                        
                        return {
                            text: itemDiv.textContent.trim() || '',
                            html: html,
                            hasHtml: true,
                            styles: itemStyles,
                            elementStyles: elementStyles
                        };
                    }
                    
                    // Fallback до textarea якщо поля не знайдено
                    const textarea = itemDiv.querySelector('.list-item-html-value');
                    if (textarea) {
                        const itemIndex = parseInt(itemDiv.dataset.itemIndex);
                        const originalItem = elementData.items[itemIndex];
                        const itemStyles = originalItem && typeof originalItem === 'object' ? (originalItem.styles || '') : '';
                        
                        return {
                            text: itemDiv.textContent.trim() || '',
                            html: textarea.value,
                            hasHtml: true,
                            styles: itemStyles
                        };
                    }
                    
                    const originalItem = elementData.items[itemIndex] || { text: '', html: '', hasHtml: true };
                    return {
                        ...originalItem,
                        styles: originalItem.styles || ''
                    };
                });
            } else if (elementData.listCodeEditors) {
                // Старий режим з CodeMirror
                editData.items = elementData.items.map((item, index) => {
                    const editor = elementData.listCodeEditors[index];
                    if (editor) {
                        const html = editor.getValue();
                        return {
                            text: item.text || '',
                            html: html,
                            hasHtml: true
                        };
                    }
                    return item;
                });
            } else {
                // Fallback
                editData.items = elementData.items;
            }
        } else {
            // Зберегти простий текст з input полів
            const items = Array.from(document.querySelectorAll('.list-item-input'));
            editData.items = items.map(input => input.value);
        }
        
        editData.listType = elementData.listType;
        
        // Оновити список в preview перед збереженням
        const listElement = elementData.element;
        listElement.innerHTML = '';
        editData.items.forEach((item, index) => {
            const li = document.createElement('li');
            if (typeof item === 'object' && item.html) {
                li.innerHTML = item.html;
                if (item.styles) {
                    li.setAttribute('style', item.styles);
                }
                // Застосувати стилі для внутрішніх елементів
                if (item.elementStyles) {
                    const editableTags = ['span', 'strong', 'em', 'b', 'i', 'mark', 'code', 'kbd', 'abbr', 'small', 'sup', 'sub', 'time', 'bdi', 'bdo', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
                    const parsedElements = parseHTMLContent(item.html, true); // true = isListItem
                    parsedElements.forEach((parsedElem, idx) => {
                        if (parsedElem.type === 'element' && item.elementStyles[parsedElem.id]) {
                            const elementsOfTag = Array.from(li.querySelectorAll(parsedElem.tagName));
                            const elementIndex = parsedElements.filter((e, i) => 
                                i < idx && e.type === 'element' && e.tagName === parsedElem.tagName
                            ).length;
                            if (elementsOfTag[elementIndex]) {
                                elementsOfTag[elementIndex].setAttribute('style', item.elementStyles[parsedElem.id]);
                            }
                        }
                    });
                }
            } else {
                const text = typeof item === 'string' ? item : (item.text || '');
                li.textContent = text;
                if (typeof item === 'object' && item.styles) {
                    li.setAttribute('style', item.styles);
                }
            }
            listElement.appendChild(li);
        });
    }

    // Оновити елемент в preview перед збереженням
    // (це вже зроблено через updateElementPreview в реальному часі)
    
    // Закрити сайдбар (але не очищати codeEditor тут, щоб збереження могло отримати значення)
    const sidebar = document.getElementById('edit-sidebar');
    sidebar.classList.remove('open');
    
    if (currentEditingElement) {
        const elementData = elementDataMap.get(currentEditingElement);
        if (elementData && elementData.element) {
            elementData.element.classList.remove('editing');
        }
    }

    // Зберегти весь екран (отправити весь HTML)
    await saveEntireScreen();
    
    // Після збереження очистити редактор та поточний елемент
    if (codeEditor) {
        const wrapper = document.getElementById('code-editor-wrapper');
        if (wrapper) {
            wrapper.innerHTML = '';
        }
        codeEditor = null;
    }
    
    if (currentEditingElement) {
        currentEditingElement = null;
    }
}

// Зберегти всі зміни екрана (старий метод - для зворотної сумісності)
async function saveScreenChanges() {
    if (!currentScreen) return;

    const screenChanges = pendingChanges[currentScreen._id];
    if (!screenChanges || screenChanges.length === 0) {
        return;
    }

    showLoader();
    try {
        console.log('Sending changes to server:', screenChanges);
        const response = await fetch(`/api/screens/${currentScreen._id}/content`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ textEdits: screenChanges }),
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Server response:', result);
            currentScreen = result;
            pendingChanges[currentScreen._id] = [];
            document.getElementById('save-changes-btn').style.display = 'none';
            
            // Оновити preview
            showPreview();
            alert('Changes saved!');
        } else {
            const errorText = await response.text();
            console.error('Server response error:', response.status, errorText);
            throw new Error('Save error: ' + errorText);
        }
    } catch (error) {
        console.error('Error saving screen:', error);
        alert('Error saving screen');
    } finally {
        hideLoader();
    }
}

// Зберегти весь екран (новий метод - відправляє весь HTML)
async function saveEntireScreen() {
    if (!currentScreen) return;
    
    const frame = document.getElementById('preview-frame');
    if (!frame) {
        console.error('preview-frame not found');
        return;
    }
    
    // Отримати весь HTML з preview-frame
    // Видаляємо всі атрибути data-edit-id та класи editable-element перед збереженням
    const frameClone = frame.cloneNode(true);
    
    // Очистити всі атрибути редагування
    frameClone.querySelectorAll('[data-edit-id]').forEach(el => {
        el.removeAttribute('data-edit-id');
        el.removeAttribute('data-element-type');
        el.classList.remove('editable-element', 'editing');
    });
    
    // Явно встановити атрибути value та selected перед збереженням HTML
    // Це потрібно, бо браузер не завжди включає ці атрибути в innerHTML
    
    // Для input елементів - явно встановити атрибут value
    frameClone.querySelectorAll('input').forEach(input => {
        if (input.type === 'text' || input.type === 'email' || input.type === 'password' || 
            input.type === 'number' || input.type === 'tel' || input.type === 'url' ||
            input.type === 'search' || !input.type || input.type === '') {
            const value = input.value || '';
            input.setAttribute('value', value);
        } else if (input.type === 'checkbox' || input.type === 'radio') {
            if (input.checked) {
                input.setAttribute('checked', 'checked');
            } else {
                input.removeAttribute('checked');
            }
        }
    });
    
    // Для textarea - значення зберігається в innerHTML, але переконаємося що воно встановлено
    frameClone.querySelectorAll('textarea').forEach(textarea => {
        const value = textarea.value || '';
        textarea.textContent = value;
    });
    
    // Для select - явно встановити selected для option елементів
    frameClone.querySelectorAll('select').forEach(select => {
        const selectedValue = select.value;
        Array.from(select.options).forEach(option => {
            if (option.value === selectedValue) {
                option.setAttribute('selected', 'selected');
            } else {
                option.removeAttribute('selected');
            }
        });
    });
    
    // Отримати HTML (тільки внутрішній контент, без самого preview-frame)
    let updatedHtml = frameClone.innerHTML;
    
    // Удалить недопустимые <br> теги перед сохранением
    updatedHtml = removeInvalidBrTags(updatedHtml);
    
    console.log('Saving entire screen HTML, length:', updatedHtml.length);
    
    showLoader();
    try {
        const response = await fetch(`/api/screens/${currentScreen._id}/html`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ html: updatedHtml }),
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Screen successfully saved:', result);
            currentScreen = result;
            document.getElementById('save-changes-btn').style.display = 'none';
            
            // Оновити preview
            showPreview();
            alert('Changes saved!');
        } else {
            const errorText = await response.text();
            console.error('Server response error:', response.status, errorText);
            throw new Error('Save error: ' + errorText);
        }
    } catch (error) {
        console.error('Error saving screen:', error);
        alert('Error saving screen: ' + error.message);
    } finally {
        hideLoader();
    }
}

// Закрити сайдбар редагування
function closeEditSidebar() {
    const sidebar = document.getElementById('edit-sidebar');
    sidebar.classList.remove('open');

    // Знищити CodeMirror редактор якщо він існує
    if (codeEditor) {
        const wrapper = document.getElementById('code-editor-wrapper');
        if (wrapper) {
            wrapper.innerHTML = '';
        }
        codeEditor = null;
    }

    // Знищити CodeMirror редактори для списків
    if (currentEditingElement) {
        const elementData = elementDataMap.get(currentEditingElement);
        if (elementData) {
            if (elementData.element) {
                elementData.element.classList.remove('editing');
            }
            if (elementData.type === 'list' && elementData.listCodeEditors) {
                elementData.listCodeEditors.forEach((editor, index) => {
                    if (editor) {
                        const editorWrapper = document.getElementById(`list-item-editor-${index}`);
                        if (editorWrapper) {
                            editorWrapper.innerHTML = '';
                        }
                    }
                });
                elementData.listCodeEditors = [];
            }
        }
        currentEditingElement = null;
    }
}


// Delete screen
// Duplicate screen
async function duplicateScreen(screenId) {
    showLoader();
    try {
        const response = await fetch(`/api/screens/${screenId}/duplicate`, {
            method: 'POST',
        });
        
        if (!response.ok) {
            throw new Error('Failed to duplicate screen');
        }
        
        const duplicatedScreen = await response.json();
        
        // Reload screens list based on current context
        if (currentClient) {
            const clientId = typeof currentClient === 'string' ? currentClient : currentClient._id;
            await loadClientScreens(clientId);
        } else {
            await loadScreens();
        }
        
        // If we're in the modal with default screens, reload that list too
        const defaultScreensList = document.getElementById('default-screens-list');
        if (defaultScreensList && defaultScreensList.offsetParent !== null) {
            await loadDefaultScreensList();
        }
        
        // Show success message
        const nameEl = document.getElementById('current-screen-name');
        if (nameEl) {
            nameEl.textContent = `Screen "${duplicatedScreen.name}" duplicated successfully`;
            setTimeout(() => {
                if (currentScreen) {
                    nameEl.textContent = currentScreen.name;
                } else {
                    nameEl.textContent = '';
                }
            }, 2000);
        }
    } catch (error) {
        console.error('Error duplicating screen:', error);
        alert('Error duplicating screen');
    }
}

function previewScreenInNewWindow(screenId) {
    const previewUrl = `/api/screens/${screenId}/preview`;
    window.open(previewUrl, '_blank', 'width=1440,height=1024,scrollbars=yes,resizable=yes');
}

async function deleteScreen(screenId) {
    if (!confirm('Are you sure you want to delete this screen?')) return;

    showLoader();
    try {
        const response = await fetch(`/api/screens/${screenId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            await loadScreens();
            if (currentScreen && currentScreen._id === screenId) {
                currentScreen = null;
                const nameEl = document.getElementById('current-screen-name');
                if (nameEl) nameEl.textContent = '';
                showPreview();
            }
        } else {
            throw new Error('Error deleting screen');
        }
    } catch (error) {
        console.error('Error deleting screen:', error);
        alert('Error deleting screen');
    } finally {
        hideLoader();
    }
}


// Generate PDF (all screens in order from database)
async function generatePDF() {
    showLoader();
    try {
        const response = await fetch('/api/pdf/generate-custom', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                clientId: currentClient || null,
                templateId: currentTemplate || null,
                isDefault: !currentClient && !currentTemplate,
            }),
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            let fileName;
            if (currentTemplate) {
                fileName = `template_${currentTemplate}_${Date.now()}.pdf`;
            } else if (currentClient) {
                fileName = `client_${currentClient}_${Date.now()}.pdf`;
            } else {
                fileName = `default_screens_${Date.now()}.pdf`;
            }
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            throw new Error('Error generating PDF');
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF');
    } finally {
        hideLoader();
    }
}

// Ініціалізувати drag-and-drop для екранів
function initScreenDragAndDrop() {
    const screensList = document.getElementById('screens-list');
    
    if (screensList && typeof Sortable !== 'undefined') {
        // Видалити існуючий Sortable, якщо він є
        if (screensList.sortableInstance) {
            screensList.sortableInstance.destroy();
        }
        
        screensList.sortableInstance = Sortable.create(screensList, {
            animation: 150,
            onEnd: async function(evt) {
                await updateScreenOrder();
            }
        });
    }
}

// Оновити порядок екранів
async function updateScreenOrder() {
    const items = Array.from(document.querySelectorAll('.screen-item'));
    const updates = items.map((item, index) => ({
        id: item.dataset.screenId,
        order: index,
    }));

    try {
        await fetch('/api/screens/reorder', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ screens: updates }),
        });
        
        // Оновити порядок в локальному масиві
        updates.forEach(update => {
            const screen = screens.find(s => s._id === update.id);
            if (screen) {
                screen.order = update.order;
            }
        });
        
        // Перерендерити екрани для відображення нового порядку
        renderScreens();
    } catch (error) {
        console.error('Error updating screen order:', error);
    } finally {
        hideLoader();
    }
}

// Universal Screen Modal Functions
async function showScreenModal(screenId = null) {
    editingScreenId = screenId;
    const modal = document.getElementById('screen-modal');
    const title = document.getElementById('screen-modal-title');
    const nameInput = document.getElementById('screen-modal-name');
    const fileInput = document.getElementById('screen-modal-file');
    const htmlTextarea = document.getElementById('screen-modal-html');
    const defaultScreensTabBtn = document.getElementById('default-screens-tab-btn');
    const defaultScreensTab = document.getElementById('import-default-tab');
    
    const tagsInput = document.getElementById('screen-modal-tags');
    const tagsGroup = document.getElementById('screen-tags-group');
    const tagsList = document.getElementById('tags-list');
    
    if (screenId) {
        // Edit mode
        title.innerHTML = '<i class="fas fa-edit"></i> Edit Screen';
        const screen = screens.find(s => s._id === screenId);
        if (screen) {
            nameInput.value = screen.name;
            htmlTextarea.value = screen.editedHtml || screen.originalHtml || '';
            if (tagsList && screen.tags && Array.isArray(screen.tags)) {
                renderTags(screen.tags);
            } else if (tagsList) {
                tagsList.innerHTML = '';
            }
        }
        if (defaultScreensTabBtn) {
            defaultScreensTabBtn.style.display = 'none';
        }
        if (tagsGroup) {
            tagsGroup.style.display = 'block';
        }
    } else {
        // Create mode
        title.innerHTML = '<i class="fas fa-plus"></i> Add Screen';
        nameInput.value = '';
        htmlTextarea.value = '';
        if (tagsList) tagsList.innerHTML = '';
        if (tagsInput) tagsInput.value = '';
        
        // Показать вкладку "Select from Library" только если добавляем экран к клиенту или шаблону
        // В библиотеке эта вкладка не нужна
        if (defaultScreensTabBtn) {
            if (currentClient || currentTemplate) {
                defaultScreensTabBtn.style.display = 'inline-flex';
            } else {
                defaultScreensTabBtn.style.display = 'none';
            }
        }
    }
    
    // Initialize tags input handler (remove old listeners first)
    if (tagsInput) {
        const newInput = tagsInput.cloneNode(true);
        tagsInput.parentNode.replaceChild(newInput, tagsInput);
        const freshInput = document.getElementById('screen-modal-tags');
        if (freshInput) {
            freshInput.addEventListener('keydown', handleTagsInputKeydown);
            freshInput.addEventListener('blur', handleTagsInputBlur);
        }
    }
    
    fileInput.value = '';
    
    // Сначала открываем модальное окно, потом переключаем вкладку
    modal.classList.add('show');
    
    // Переключаем вкладку: "Select from Library" для клиентов/шаблонов, "Upload File" для библиотеки
    // Используем setTimeout чтобы дать время DOM обновиться
    setTimeout(() => {
        if (!screenId && (currentClient || currentTemplate)) {
            // Для клиентов и шаблонов - вкладка "Select from Library"
            switchImportTab('default');
            
            // Завантажити список дефолтних екранів
            setTimeout(async () => {
                await loadDefaultScreensList();
            }, 150);
        } else {
            // Для библиотеки - вкладка "Upload File"
            switchImportTab('file');
        }
    }, 50);
}

function closeScreenModal() {
    const modal = document.getElementById('screen-modal');
    modal.classList.remove('show');
    editingScreenId = null;
    document.getElementById('screen-modal-name').value = '';
    document.getElementById('screen-modal-file').value = '';
    document.getElementById('screen-modal-html').value = '';
    const tagsInput = document.getElementById('screen-modal-tags');
    const tagsList = document.getElementById('tags-list');
    if (tagsInput) tagsInput.value = '';
    if (tagsList) tagsList.innerHTML = '';
    
    // Очистити вибрані checkbox дефолтних екранів
    document.querySelectorAll('.default-screen-checkbox').forEach(cb => {
        cb.checked = false;
    });
    
    // Сбросить фильтр тегов
    const tagFilter = document.getElementById('screen-tag-filter');
    if (tagFilter) tagFilter.value = '';
    
    // Скинути вкладку в зависимости от контекста
    if (currentClient || currentTemplate) {
        // Для клиентов и шаблонов - "Select from Library"
        switchImportTab('default');
    } else {
        // Для библиотеки - "Upload File"
        switchImportTab('file');
    }
}

// Tags input handlers
function handleTagsInputKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTagFromInput();
    } else if (e.key === 'Backspace' && e.target.value === '') {
        // Remove last tag if input is empty
        const tagsList = document.getElementById('tags-list');
        const lastTag = tagsList?.lastElementChild;
        if (lastTag) {
            lastTag.remove();
        }
    }
}

function handleTagsInputBlur(e) {
    // Add tag when input loses focus if there's text
    if (e.target.value.trim()) {
        addTagFromInput();
    }
}

function addTagFromInput() {
    const tagsInput = document.getElementById('screen-modal-tags');
    const tagsList = document.getElementById('tags-list');
    if (!tagsInput || !tagsList) return;
    
    const tagValue = tagsInput.value.trim();
    if (tagValue) {
        const existingTags = getCurrentTags();
        if (!existingTags.includes(tagValue)) {
            addTagToDisplay(tagValue);
            tagsInput.value = '';
        } else {
            tagsInput.value = '';
        }
    }
}

function addTagToDisplay(tagValue) {
    const tagsList = document.getElementById('tags-list');
    if (!tagsList) return;
    
    const tagItem = document.createElement('div');
    tagItem.className = 'tag-item';
    tagItem.innerHTML = `
        <i class="fas fa-tag" style="font-size: 10px; opacity: 0.9;"></i>
        <span>${escapeHtml(tagValue)}</span>
        <button type="button" class="tag-remove" onclick="removeTag(this)" title="Remove tag">
            <i class="fas fa-times"></i>
        </button>
    `;
    tagsList.appendChild(tagItem);
}

function removeTag(button) {
    const tagItem = button.closest('.tag-item');
    if (tagItem) {
        tagItem.style.animation = 'tagSlideIn 0.2s ease reverse';
        setTimeout(() => tagItem.remove(), 200);
    }
}

function getCurrentTags() {
    const tagsList = document.getElementById('tags-list');
    if (!tagsList) return [];
    
    return Array.from(tagsList.querySelectorAll('.tag-item span'))
        .map(span => span.textContent.trim())
        .filter(tag => tag);
}

function renderTags(tags) {
    const tagsList = document.getElementById('tags-list');
    if (!tagsList) return;
    
    tagsList.innerHTML = '';
    if (tags && Array.isArray(tags)) {
        tags.forEach(tag => {
            if (tag && tag.trim()) {
                addTagToDisplay(tag.trim());
            }
        });
    }
}

function switchImportTab(tab) {
    // Убираем активность со всех вкладок и контента
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const nameInput = document.getElementById('screen-modal-name');
    const nameRequired = document.getElementById('screen-name-required');
    const nameGroup = document.getElementById('screen-name-group');
    const tagsGroup = document.getElementById('screen-tags-group');
    
    if (tab === 'default') {
        const defaultTabBtn = document.getElementById('default-screens-tab-btn');
        const defaultTabContent = document.getElementById('import-default-tab');
        if (defaultTabBtn && defaultTabContent) {
            defaultTabBtn.classList.add('active');
            defaultTabContent.classList.add('active');
            // При виборі дефолтних екранів поле імені не обов'язкове
            if (nameInput) nameInput.required = false;
            if (nameRequired) nameRequired.style.display = 'none';
            if (nameGroup) nameGroup.style.display = 'none';
            if (tagsGroup) tagsGroup.style.display = 'none';
        }
    } else if (tab === 'file') {
        const fileTabBtn = document.querySelector('.tab-btn[onclick*="switchImportTab(\'file\')"]');
        const fileTabContent = document.getElementById('import-file-tab');
        if (fileTabBtn && fileTabContent) {
            fileTabBtn.classList.add('active');
            fileTabContent.classList.add('active');
            if (nameInput) nameInput.required = true;
            if (nameRequired) nameRequired.style.display = 'inline';
            if (nameGroup) nameGroup.style.display = 'block';
            if (tagsGroup) tagsGroup.style.display = 'block';
        }
    } else if (tab === 'text') {
        const textTabBtn = document.querySelector('.tab-btn[onclick*="switchImportTab(\'text\')"]');
        const textTabContent = document.getElementById('import-text-tab');
        if (textTabBtn && textTabContent) {
            textTabBtn.classList.add('active');
            textTabContent.classList.add('active');
            if (nameInput) nameInput.required = true;
            if (nameRequired) nameRequired.style.display = 'inline';
            if (nameGroup) nameGroup.style.display = 'block';
            if (tagsGroup) tagsGroup.style.display = 'block';
        }
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('screen-modal-html').value = e.target.result;
            switchImportTab('text');
        };
        reader.readAsText(file);
    }
}

// Завантажити список дефолтних екранів
let defaultScreensList = [];
let allDefaultScreensList = []; // Полный список для фильтрации
async function loadDefaultScreensList() {
    const listContainer = document.getElementById('default-screens-list');
    const loadingState = document.getElementById('default-screens-loading');
    
    // Перевірити чи елементи існують
    if (!listContainer) {
        console.warn('default-screens-list element not found');
        return;
    }
    
    try {
        if (loadingState) {
            loadingState.style.display = 'block';
        }
        listContainer.innerHTML = '';
        
        showLoader();
        
        // Загрузить теги для фильтра
        await loadTagsForFilter();
        
        // Получить выбранный тег для фильтрации
        const tagFilter = document.getElementById('screen-tag-filter');
        const selectedTag = tagFilter ? tagFilter.value : '';
        
        let url = '/api/screens?isDefault=true';
        if (selectedTag) {
            url += `&tags=${encodeURIComponent(selectedTag)}`;
        }
        
        const response = await fetch(url);
        defaultScreensList = await response.json();
        
        // Сохранить полный список для фильтрации
        if (!selectedTag) {
            allDefaultScreensList = defaultScreensList;
        }
        
        // Если фильтр активен, но нет результатов, загрузить все для отображения
        if (defaultScreensList.length === 0 && selectedTag) {
            const allResponse = await fetch('/api/screens?isDefault=true');
            allDefaultScreensList = await allResponse.json();
        } else if (!selectedTag) {
            allDefaultScreensList = defaultScreensList;
        }
        
        if (defaultScreensList.length === 0) {
            listContainer.innerHTML = '<div class="empty-state"><p>No screens found with selected tag</p></div>';
            if (loadingState) {
                loadingState.style.display = 'none';
            }
            hideLoader();
            return;
        }
        
        // Відобразити список з checkbox та iframe прев'ю
        listContainer.innerHTML = '';
        defaultScreensList.forEach(screen => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'default-screen-item';
            const previewId = `default-preview-${screen._id}`;
            const previewHtml = screen.editedHtml || screen.originalHtml || '';
            
            const tagsDisplay = screen.tags && screen.tags.length > 0 
                ? `<div class="screen-tags">
                    ${screen.tags.map(tag => `<span class="tag-badge" title="Tag: ${escapeHtml(tag)}"><i class="fas fa-tag" style="font-size: 9px; margin-right: 4px; opacity: 0.7;"></i>${escapeHtml(tag)}</span>`).join('')}
                   </div>`
                : '';
            
            itemDiv.innerHTML = `
                <div class="default-screen-item-head">
                <label class="checkbox-label">
                    <input type="checkbox" class="default-screen-checkbox" value="${screen._id}" data-screen-name="${screen.name}">
                    <span class="checkbox-text">${screen.name}</span>
                </label>
                ${tagsDisplay}
                </div>
                <div class="default-screen-preview-wrapper">
                    <div class="duplicate-overlay">
                        <button class="duplicate-btn" onclick="event.stopPropagation(); duplicateScreen('${screen._id}')" title="Duplicate screen">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="preview-btn" onclick="event.stopPropagation(); previewScreenInNewWindow('${screen._id}')" title="Preview screen in new window">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </div>
                    <iframe id="${previewId}" class="default-screen-preview-iframe" frameborder="0" scrolling="no"></iframe>
                </div>
            `;
            
            listContainer.appendChild(itemDiv);
            
            // Set iframe content after element is added to DOM
            setTimeout(() => {
                const iframe = document.getElementById(previewId);
                if (!iframe) {
                    console.warn(`Iframe not found for preview: ${previewId}`);
                    return;
                }
                if (previewHtml) {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        if (!iframeDoc) {
                            console.warn(`Iframe document not accessible for: ${previewId}`);
                            return;
                        }
                        
                        // Додати клас "full" до body або головного контейнера в HTML (тільки всередині iframe)
                        let modifiedHtml = previewHtml;
                        
                        // Перевірити чи є body тег
                        if (modifiedHtml.includes('<body')) {
                            // Додати клас до body
                            modifiedHtml = modifiedHtml.replace(/<body([^>]*)>/i, (match, attrs) => {
                                // Перевірити чи вже є клас full
                                if (attrs && attrs.includes('class=')) {
                                    // Додати клас до існуючого атрибута class
                                    return match.replace(/class="([^"]*)"/i, (m, classes) => {
                                        if (!classes.includes('full')) {
                                            return `class="${classes} full"`;
                                        }
                                        return m;
                                    });
                                } else {
                                    // Додати новий атрибут class
                                    return `<body class="full"${attrs}>`;
                                }
                            });
                        } else {
                            // Якщо немає body, знайти головний div з класом print-scope
                            if (modifiedHtml.includes('class="print-scope')) {
                                modifiedHtml = modifiedHtml.replace(/class="print-scope([^"]*)"/i, (match, classes) => {
                                    if (!classes || !classes.includes('full')) {
                                        return `class="print-scope${classes || ''} full"`;
                                    }
                                    return match;
                                });
                            } else if (modifiedHtml.includes("class='print-scope")) {
                                modifiedHtml = modifiedHtml.replace(/class='print-scope([^']*)'/i, (match, classes) => {
                                    if (!classes || !classes.includes('full')) {
                                        return `class='print-scope${classes || ''} full'`;
                                    }
                                    return match;
                                });
                            } else if (modifiedHtml.includes('class="slide')) {
                                // Знайти перший div з класом slide
                                modifiedHtml = modifiedHtml.replace(/class="slide([^"]*)"/i, (match, classes) => {
                                    if (!classes || !classes.includes('full')) {
                                        return `class="slide${classes || ''} full"`;
                                    }
                                    return match;
                                });
                            } else {
                                // Якщо немає нічого, обгорнути в body з класом full
                                if (!modifiedHtml.includes('<body')) {
                                    // Якщо немає навіть html тега, додати повну структуру
                                    if (!modifiedHtml.includes('<html')) {
                                        modifiedHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body class="full">' + modifiedHtml + '</body></html>';
                                    } else {
                                        modifiedHtml = modifiedHtml.replace(/<html([^>]*)>/i, (match, attrs) => {
                                            return match + '<body class="full">';
                                        });
                                        if (!modifiedHtml.includes('</body>')) {
                                            modifiedHtml = modifiedHtml.replace(/<\/html>/i, '</body></html>');
                                        }
                                    }
                                }
                            }
                        }
                        
                        iframeDoc.open();
                        iframeDoc.write(modifiedHtml);
                        iframeDoc.close();
                    } catch (error) {
                        console.error('Error setting iframe content for default screen:', error);
                    }
                } else {
                    console.warn(`No preview HTML for screen: ${screen.name}`);
                }
            }, 150);
        });
        
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading default screens:', error);
        listContainer.innerHTML = '<div class="error-state"><p>Error loading default screens</p></div>';
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    } finally {
        hideLoader();
    }
}

// Загрузить теги для фильтра
async function loadTagsForFilter() {
    try {
        const response = await fetch('/api/screens/tags/all');
        const tags = await response.json();
        const tagFilter = document.getElementById('screen-tag-filter');
        if (tagFilter) {
            // Сохранить текущее значение
            const currentValue = tagFilter.value;
            // Очистить и заполнить заново
            tagFilter.innerHTML = '<option value="">All Tags</option>';
            tags.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                tagFilter.appendChild(option);
            });
            // Восстановить значение
            tagFilter.value = currentValue;
        }
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

// Фильтровать экраны по тегу
async function filterScreensByTag() {
    await loadDefaultScreensList();
}

// Выбрать все экраны
function selectAllScreens() {
    const checkboxes = document.querySelectorAll('.default-screen-checkbox:not([style*="display: none"])');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
}

async function saveScreenFromModal() {
    const name = document.getElementById('screen-modal-name').value;
    const htmlText = document.getElementById('screen-modal-html').value;
    const fileInput = document.getElementById('screen-modal-file');
    const activeTab = document.querySelector('.tab-content.active')?.id;
    
    // Перевірити чи вибрано дефолтні екрани
    if (activeTab === 'import-default-tab') {
        const selectedCheckboxes = document.querySelectorAll('.default-screen-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert('Please select at least one default screen');
            return;
        }
        
        // Копіювати вибрані екрани до клієнта або шаблону
        showLoader();
        try {
            const screenIds = Array.from(selectedCheckboxes).map(cb => cb.value);
            let response;
            
            if (currentClient) {
                response = await fetch(`/api/clients/${currentClient}/copy-screens`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ screenIds }),
                });
            } else if (currentTemplate) {
                response = await fetch(`/api/templates/${currentTemplate}/copy-screens`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ screenIds }),
                });
            } else {
                throw new Error('No client or template selected');
            }
            
            if (response.ok) {
                const result = await response.json();
                // Очистити вибрані checkbox перед закриттям модального вікна
                document.querySelectorAll('.default-screen-checkbox:checked').forEach(cb => {
                    cb.checked = false;
                });
                closeScreenModal();
                await loadScreens();
                const target = currentClient ? 'client' : 'template';
                alert(`Successfully added ${result.copied} screen(s) to ${target}!`);
                return;
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error copying screens');
            }
        } catch (error) {
            console.error('Error copying screens:', error);
            alert('Error copying screens: ' + error.message);
        } finally {
            hideLoader();
        }
        return;
    }
    
    // Для інших вкладок - перевірити обов'язкові поля
    if (!name && !fileInput.files[0] && !htmlText) {
        alert('Please enter a name and upload a file or paste HTML');
        return;
    }

    showLoader();
    try {
        let response;
        
        if (editingScreenId) {
            // Get tags from display
            const tags = getCurrentTags();
            
            // Update existing screen
            response = await fetch(`/api/screens/${editingScreenId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    tags: tags,
                }),
            });
            
            if (htmlText) {
                // Update content
                const screen = screens.find(s => s._id === editingScreenId);
                if (screen) {
                    await fetch(`/api/screens/${editingScreenId}/content`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            textEdits: [{
                                selector: 'body',
                                type: 'html',
                                html: htmlText
                            }]
                        }),
                    });
                }
            }
        } else {
            // Get tags from display
            const tags = getCurrentTags();
            
            // Create new screen
            if (fileInput.files[0]) {
                const formData = new FormData();
                formData.append('htmlFile', fileInput.files[0]);
                formData.append('name', name || 'New Screen');
                formData.append('isDefault', !currentClient && !currentTemplate);
                if (currentClient) {
                    formData.append('clientId', currentClient);
                }
                if (currentTemplate) {
                    formData.append('templateId', currentTemplate);
                }
                if (tags.length > 0) {
                    formData.append('tags', tags.join(','));
                }
                
                response = await fetch('/api/screens/import', {
                    method: 'POST',
                    body: formData,
                });
            } else if (htmlText) {
                response = await fetch('/api/screens/import-text', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: name || 'New Screen',
                        html: htmlText,
                        isDefault: !currentClient && !currentTemplate,
                        clientId: currentClient || null,
                        templateId: currentTemplate || null,
                        tags: tags,
                    }),
                });
            }
        }

        if (response && response.ok) {
            closeScreenModal();
            await loadScreens();
            alert(editingScreenId ? 'Screen updated successfully!' : 'Screen created successfully!');
        } else {
            throw new Error('Error saving screen');
        }
    } catch (error) {
        console.error('Error saving screen:', error);
        alert('Error saving screen');
    } finally {
        hideLoader();
    }
}

function editScreenInModal(screenId) {
    showScreenModal(screenId);
}

// Обробити завантаження зображення
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Перевірити розмір файлу (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB в байтах
    if (file.size > maxSize) {
        alert('Image size exceeds 10MB limit. Please choose a smaller image.');
        event.target.value = ''; // Очистити input
        return;
    }
    
    // Перевірити тип файлу
    if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64String = e.target.result;
        const elementData = elementDataMap.get(currentEditingElement);
        
        if (elementData && elementData.element) {
            // Оновити src зображення в preview
            elementData.element.src = base64String;
            elementData.src = base64String;
            
            // Оновити preview в сайдбарі
            const previewImg = document.querySelector('.image-preview-container img');
            if (previewImg) {
                previewImg.src = base64String;
                previewImg.style.display = 'block';
                const errorDiv = previewImg.nextElementSibling;
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                }
            }
        }
    };
    
    reader.onerror = function() {
        alert('Error reading image file. Please try again.');
        event.target.value = '';
    };
    
    reader.readAsDataURL(file);
}

// Client Management Functions
async function showClientModal() {
    editingClientId = null;
    shouldImportDefaultScreens = false;
    document.getElementById('client-name').value = '';
    document.getElementById('client-email').value = '';
    document.getElementById('client-phone').value = '';
    document.getElementById('client-notes').value = '';
    document.getElementById('client-modal-title').innerHTML = '<i class="fas fa-user-plus"></i> Create Client';
    const importBtn = document.getElementById('import-default-btn');
    importBtn.style.display = 'block';
    importBtn.style.background = 'var(--primary-color)';
    importBtn.innerHTML = '<i class="fas fa-download"></i> Import Default Screens';
    
    // Загрузить шаблоны для выпадающего списка
    await loadTemplatesForClientModal();
    
    document.getElementById('client-modal').classList.add('show');
}

async function importDefaultScreens() {
    shouldImportDefaultScreens = true;
    document.getElementById('import-default-btn').style.background = 'var(--success-color)';
    document.getElementById('import-default-btn').innerHTML = '<i class="fas fa-check"></i> Will Import Default Screens';
}

// Import default screens for existing client (with replacement)
async function importDefaultScreensForExistingClient() {
    if (!editingClientId) return;
    
    if (!confirm('Warning: This will replace all existing screens for this client with default screens. Continue?')) {
        return;
    }
    
    showLoader();
    try {
        const response = await fetch(`/api/clients/${editingClientId}/import-default-screens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ replace: true }),
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(`Successfully imported ${result.imported} default screens. Existing screens were replaced.`);
            
            // If we're currently viewing this client's screens, reload them
            if (currentClient === editingClientId) {
                await loadClientScreens(editingClientId);
            }
        } else {
            throw new Error('Error importing screens');
        }
    } catch (error) {
        console.error('Error importing default screens:', error);
        alert('Error importing default screens');
    } finally {
        hideLoader();
    }
}

async function saveClient() {
    const name = document.getElementById('client-name').value;
    const email = document.getElementById('client-email').value;
    const phone = document.getElementById('client-phone').value;
    const notes = document.getElementById('client-notes').value;
    
    if (!name) {
        alert('Please enter client name');
        return;
    }

    showLoader();
    try {
        const response = await fetch('/api/clients', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, phone, notes }),
        });

        if (response.ok) {
            const client = await response.json();
            
            // Apply template if selected
            const selectedTemplateId = document.getElementById('client-template-select')?.value;
            if (selectedTemplateId) {
                try {
                    const templateResponse = await fetch(`/api/templates/${selectedTemplateId}/apply-to-client/${client._id}`, {
                        method: 'POST',
                    });
                    if (templateResponse.ok) {
                        const result = await templateResponse.json();
                        console.log(`Template applied. ${result.applied} screens were added.`);
                    }
                } catch (err) {
                    console.error('Error applying template:', err);
                }
            }
            
            // Import default screens if button was clicked
            if (shouldImportDefaultScreens) {
                try {
                    await fetch(`/api/clients/${client._id}/import-default-screens`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ replace: false }), // Don't replace on creation (no existing screens)
                    });
                } catch (err) {
                    console.error('Error importing default screens:', err);
                }
            }
            
            shouldImportDefaultScreens = false;
            await loadClients();
            closeClientModal();
            alert('Client created successfully!');
        } else {
            throw new Error('Error creating client');
        }
    } catch (error) {
        console.error('Error creating client:', error);
        alert('Error creating client');
    } finally {
        hideLoader();
    }
}

function editClient(clientId, event) {
    if (event) event.stopPropagation();
    
    editingClientId = clientId;
    const client = clients.find(c => c._id === clientId);
    if (!client) return;
    
    document.getElementById('edit-client-name').value = client.name || '';
    document.getElementById('edit-client-email').value = client.email || '';
    document.getElementById('edit-client-phone').value = client.phone || '';
    document.getElementById('edit-client-notes').value = client.notes || '';
    // Load templates for dropdown when opening edit modal
    loadTemplatesForDropdown();
    document.getElementById('edit-client-modal').classList.add('show');
}

function closeEditClientModal() {
    document.getElementById('edit-client-modal').classList.remove('show');
    editingClientId = null;
}

async function updateClient() {
    const name = document.getElementById('edit-client-name').value;
    const email = document.getElementById('edit-client-email').value;
    const phone = document.getElementById('edit-client-phone').value;
    const notes = document.getElementById('edit-client-notes').value;
    
    if (!name) {
        alert('Please enter client name');
        return;
    }

    showLoader();
    try {
        const response = await fetch(`/api/clients/${editingClientId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, phone, notes }),
        });

        if (response.ok) {
            await loadClients();
            closeEditClientModal();
            alert('Client updated successfully!');
        } else {
            throw new Error('Error updating client');
        }
    } catch (error) {
        console.error('Error updating client:', error);
        alert('Error updating client');
    } finally {
        hideLoader();
    }
}

async function deleteCurrentClient() {
    if (!confirm('Are you sure you want to delete this client? All their screens will be deleted.')) return;

    showLoader();
    try {
        const response = await fetch(`/api/clients/${editingClientId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            await loadClients();
            closeEditClientModal();
            // if (currentClient === editingClientId) {
            //     navigateTo('/screens');
            // }
            alert('Client deleted successfully!');
        } else {
            throw new Error('Error deleting client');
        }
    } catch (error) {
        console.error('Error deleting client:', error);
        alert('Error deleting client');
    } finally {
        hideLoader();
    }
}

function closeClientModal() {
    document.getElementById('client-modal').classList.remove('show');
    editingClientId = null;
    // Сбросить выбор шаблона
    const templateSelect = document.getElementById('client-template-select');
    if (templateSelect) {
        templateSelect.value = '';
    }
}

// ==================== TEMPLATE MANAGEMENT FUNCTIONS ====================

// Load templates
async function loadTemplates() {
    showLoader();
    try {
        const response = await fetch('/api/templates');
        templates = await response.json();
        renderTemplates();
        // Also load templates for the client edit modal dropdown
        loadTemplatesForDropdown();
    } catch (error) {
        console.error('Error loading templates:', error);
        alert('Error loading templates');
    } finally {
        hideLoader();
    }
}

// Render templates
function renderTemplates() {
    const templatesList = document.getElementById('templates-list');
    const emptyTemplates = document.getElementById('empty-templates');
    if (!templatesList) return;
    
    templatesList.innerHTML = '';

    if (templates.length === 0) {
        if (emptyTemplates) emptyTemplates.style.display = 'block';
        return;
    }
    
    if (emptyTemplates) emptyTemplates.style.display = 'none';

    templates.forEach(template => {
        const li = document.createElement('li');
        li.className = 'client-item';
        li.dataset.templateId = template._id;
        li.innerHTML = `
            <div class="client-header">${template.name}</div>
            ${template.description ? `<div class="client-info"><i class="fas fa-info-circle"></i> ${template.description}</div>` : ''}
            <div class="client-actions">
                <button onclick="selectTemplate('${template._id}', event)" title="Open template screens">
                    Screens
                </button>
                <button onclick="editTemplate('${template._id}', event)" title="Edit template">
                    Settings
                </button>
            </div>
        `;
        templatesList.appendChild(li);
    });
}

// Select template and view their screens
async function selectTemplate(templateId, event) {
    if (event) event.stopPropagation();
    
    navigateTo(`/template/${templateId}`);
}

// Load template screens (called by router)
async function loadTemplateScreens(templateId) {
    currentTemplate = templateId;
    currentMode = 'default'; // We're viewing screens, but template screens
    
    showLoader();
    try {
        const response = await fetch(`/api/templates/${templateId}`);
        const data = await response.json();
        screens = data.screens || []; // Ensure it's an array
        
        updateUI();
        renderScreens();
        
        // Highlight template in list if templates view is visible
        document.querySelectorAll('.client-item[data-template-id]').forEach(item => {
            item.classList.remove('selected');
        });
        const templateItem = document.querySelector(`[data-template-id="${templateId}"]`);
        if (templateItem) {
            templateItem.classList.add('selected');
        }
    } catch (error) {
        console.error('Error loading template data:', error);
        alert('Error loading template data');
        // Set empty screens on error
        screens = [];
        updateUI();
        renderScreens();
    } finally {
        hideLoader();
    }
}

// Show template modal
function showTemplateModal() {
    editingTemplateId = null;
    document.getElementById('template-name').value = '';
    document.getElementById('template-description').value = '';
    document.getElementById('template-modal-title').innerHTML = '<i class="fas fa-file-alt"></i> Create Template';
    document.getElementById('template-modal').classList.add('show');
}

// Save template
async function saveTemplate() {
    const name = document.getElementById('template-name').value;
    const description = document.getElementById('template-description').value;
    
    if (!name) {
        alert('Please enter template name');
        return;
    }

    showLoader();
    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description }),
        });

        if (response.ok) {
            await loadTemplates();
            closeTemplateModal();
            alert('Template created successfully!');
        } else {
            throw new Error('Error creating template');
        }
    } catch (error) {
        console.error('Error creating template:', error);
        alert('Error creating template');
    } finally {
        hideLoader();
    }
}

// Edit template
function editTemplate(templateId, event) {
    if (event) event.stopPropagation();
    
    editingTemplateId = templateId;
    const template = templates.find(t => t._id === templateId);
    if (!template) return;
    
    document.getElementById('edit-template-name').value = template.name || '';
    document.getElementById('edit-template-description').value = template.description || '';
    document.getElementById('edit-template-modal').classList.add('show');
}

// Close edit template modal
function closeEditTemplateModal() {
    document.getElementById('edit-template-modal').classList.remove('show');
    editingTemplateId = null;
}

// Update template
async function updateTemplate() {
    const name = document.getElementById('edit-template-name').value;
    const description = document.getElementById('edit-template-description').value;
    
    if (!name) {
        alert('Please enter template name');
        return;
    }

    showLoader();
    try {
        const response = await fetch(`/api/templates/${editingTemplateId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description }),
        });

        if (response.ok) {
            await loadTemplates();
            closeEditTemplateModal();
            alert('Template updated successfully!');
        } else {
            throw new Error('Error updating template');
        }
    } catch (error) {
        console.error('Error updating template:', error);
        alert('Error updating template');
    } finally {
        hideLoader();
    }
}

// Delete template
async function deleteCurrentTemplate() {
    if (!confirm('Are you sure you want to delete this template? All its screens will be deleted.')) return;

    showLoader();
    try {
        const response = await fetch(`/api/templates/${editingTemplateId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            await loadTemplates();
            closeEditTemplateModal();
            if (currentTemplate === editingTemplateId) {
                navigateTo('/templates');
            }
            alert('Template deleted successfully!');
        } else {
            throw new Error('Error deleting template');
        }
    } catch (error) {
        console.error('Error deleting template:', error);
        alert('Error deleting template');
    } finally {
        hideLoader();
    }
}

// Close template modal
function closeTemplateModal() {
    document.getElementById('template-modal').classList.remove('show');
    editingTemplateId = null;
}

// Load templates for dropdown in client edit modal
async function loadTemplatesForDropdown() {
    try {
        const response = await fetch('/api/templates');
        const templatesData = await response.json();
        const select = document.getElementById('template-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select a template...</option>';
        templatesData.forEach(template => {
            const option = document.createElement('option');
            option.value = template._id;
            option.textContent = template.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading templates for dropdown:', error);
    }
}

// Load templates for dropdown in client create modal
async function loadTemplatesForClientModal() {
    try {
        const response = await fetch('/api/templates');
        const templatesData = await response.json();
        const select = document.getElementById('client-template-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select a template...</option>';
        templatesData.forEach(template => {
            const option = document.createElement('option');
            option.value = template._id;
            option.textContent = template.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading templates for client modal:', error);
    }
}

// Apply template to client
async function applyTemplateToClient() {
    if (!editingClientId) return;
    
    const templateId = document.getElementById('template-select').value;
    if (!templateId) {
        alert('Please select a template');
        return;
    }
    
    if (!confirm('Warning: This will replace all existing screens for this client with screens from the selected template. Continue?')) {
        return;
    }
    
    showLoader();
    try {
        const response = await fetch(`/api/templates/${templateId}/apply-to-client/${editingClientId}`, {
            method: 'POST',
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(`Successfully applied template. ${result.applied} screens were added.`);
            
            // If we're currently viewing this client's screens, reload them
            if (currentClient === editingClientId) {
                await loadClientScreens(editingClientId);
            }
            
            // Reset dropdown
            document.getElementById('template-select').value = '';
        } else {
            throw new Error('Error applying template');
        }
    } catch (error) {
        console.error('Error applying template:', error);
        alert('Error applying template');
    } finally {
        hideLoader();
    }
}

// ==================== END TEMPLATE MANAGEMENT FUNCTIONS ====================

// Close modals when clicking outside
window.onclick = function(event) {
    const screenModal = document.getElementById('screen-modal');
    const clientModal = document.getElementById('client-modal');
    const editClientModal = document.getElementById('edit-client-modal');
    const templateModal = document.getElementById('template-modal');
    const editTemplateModal = document.getElementById('edit-template-modal');
    
    if (event.target === screenModal) {
        closeScreenModal();
    }
    if (event.target === clientModal) {
        closeClientModal();
    }
    if (event.target === editClientModal) {
        closeEditClientModal();
    }
    if (event.target === templateModal) {
        closeTemplateModal();
    }
    if (event.target === editTemplateModal) {
        closeEditTemplateModal();
    }
}


