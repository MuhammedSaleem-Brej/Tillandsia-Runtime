const CACHE_NAME = 'html-blob-cache';
const SERVICE_WORKER_PATH = 'sw.js';

const state = {
    currentBlobUrl: null,
    runtimeFrame: null,
    currentFile: null,
    currentRuntime: null,
};

const elements = {
    mainUi: document.getElementById('main-ui'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    errorMessage: document.getElementById('error-message'),
    cacheCheckbox: document.getElementById('cache-checkbox'),
    sameOriginCheckbox: document.getElementById('allow-same-origin-cb'),
    originWarning: document.getElementById('origin-warning'),
    hardwareCheckboxes: document.querySelectorAll('#hardware-group input[type="checkbox"]'),
};

document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
    setupEventListeners();
    registerServiceWorker();
    await loadRuntimeFromUrl();
}

function setupEventListeners() {
    elements.sameOriginCheckbox.addEventListener('change', handleSameOriginChange);
    elements.fileInput.addEventListener('change', handleFileSelection);
    window.addEventListener('popstate', handleHistoryNavigation);

    ['dragenter', 'dragover'].forEach((eventName) => {
        elements.dropZone.addEventListener(eventName, handleDragEnter);
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        elements.dropZone.addEventListener(eventName, handleDragLeave);
    });

    elements.dropZone.addEventListener('drop', handleFileDrop);
    window.addEventListener('beforeunload', releaseRuntime);
}

async function loadRuntimeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const fileId = params.get('file');
    const runtimeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (!fileId) {
        setBaseHistoryState();
        return;
    }

    // A bookmarked runtime URL is a complete browser-history entry by itself.
    // Create a base entry underneath it so Back returns to the Runtime UI.
    setBaseHistoryState();
    history.pushState(
        createRuntimeHistoryState(fileId, params),
        '',
        runtimeUrl
    );

    await openCachedFile(fileId, {
        sandbox: params.get('sb'),
        permissions: params.get('al'),
    });
}

function setBaseHistoryState() {
    const baseUrl = getBaseUrl();
    history.replaceState({ runtimeBase: true }, '', baseUrl);
}

function getBaseUrl() {
    return `${window.location.pathname}${window.location.hash}`;
}

function createRuntimeHistoryState(fileId, params) {
    return {
        runtime: true,
        fileId,
        sandbox: params.get('sb') || '',
        permissions: params.get('al') || '',
    };
}

async function openCachedFile(fileId, runtime) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(buildCacheKey(fileId));

        if (!response) {
            showError('Cached file not found. It may have been cleared from your browser.');
            return false;
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        launchRuntime(blobUrl, normalizeRuntime(runtime));
        return true;
    } catch (error) {
        console.error('Error loading cached file:', error);
        showError('Failed to load the cached file.');
        return false;
    }
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register(SERVICE_WORKER_PATH)
            .then(() => console.log('Service Worker registered successfully'))
            .catch((error) => console.warn('Service Worker registration failed:', error));
    });
}

async function requestPersistentStorage() {
    if (!navigator.storage?.persist) {
        return false;
    }

    try {
        const isPersisted = await navigator.storage.persist();
        console.log(isPersisted ? 'Storage is persistent.' : 'Storage is NOT persistent.');
        return isPersisted;
    } catch (error) {
        console.warn('Persistent storage request failed:', error);
        return false;
    }
}

function handleSameOriginChange(event) {
    const enabled = event.target.checked;

    elements.originWarning.classList.toggle('hidden', !enabled);

    elements.hardwareCheckboxes.forEach((checkbox) => {
        checkbox.disabled = !enabled;

        if (!enabled) {
            checkbox.checked = false;
        }
    });
}

async function processFile(file) {
    hideError();

    if (!file) {
        return;
    }

    if (!isHtmlFile(file)) {
        showError('Invalid file type. Please select a valid HTML document.');
        return;
    }

    const runtime = getRuntimeConfiguration();

    if (elements.cacheCheckbox.checked) {
        await cacheAndLaunchFile(file, runtime);
        return;
    }

    const blobUrl = URL.createObjectURL(file);
    state.currentFile = file;
    pushRuntimeHistory(null, runtime);
    launchRuntime(blobUrl, runtime);
}

async function cacheAndLaunchFile(file, runtime) {
    try {
        await requestPersistentStorage();

        const fileId = crypto.randomUUID();
        const cache = await caches.open(CACHE_NAME);

        await cache.put(
            buildCacheKey(fileId),
            new Response(file, {
                headers: {
                    'Content-Type': 'text/html;charset=utf-8',
                },
            })
        );

        const query = buildRuntimeQuery(fileId, runtime);
        history.pushState(
            createRuntimeHistoryState(fileId, new URLSearchParams(query)),
            '',
            query
        );

        const blobUrl = URL.createObjectURL(file);
        state.currentFile = file;
        launchRuntime(blobUrl, runtime);
    } catch (error) {
        console.error('Caching failed:', error);
        showError('Failed to cache the file. Storage might be full or restricted.');
    }
}

function pushRuntimeHistory(fileId, runtime) {
    const query = fileId ? buildRuntimeQuery(fileId, runtime) : getBaseUrl();
    history.pushState(
        fileId
            ? createRuntimeHistoryState(fileId, new URLSearchParams(query))
            : {
                runtime: true,
                temporary: true,
                sandbox: runtime.sandbox.join(','),
                permissions: runtime.permissions.join(','),
            },
        '',
        query
    );
}

function handleHistoryNavigation(event) {
    if (event.state?.runtime) {
        restoreRuntimeFromHistory(event.state);
        return;
    }

    closeRuntime();
}

async function restoreRuntimeFromHistory(historyState) {
    hideError();

    if (historyState.fileId) {
        await openCachedFile(historyState.fileId, {
            sandbox: historyState.sandbox,
            permissions: historyState.permissions,
        });
        return;
    }

    if (historyState.temporary && state.currentFile) {
        const blobUrl = URL.createObjectURL(state.currentFile);
        launchRuntime(blobUrl, normalizeRuntime({
            sandbox: historyState.sandbox,
            permissions: historyState.permissions,
        }));
        return;
    }

    closeRuntime();
}

function getRuntimeConfiguration() {
    return normalizeRuntime({
        sandbox: getCheckedValues('sb'),
        permissions: getCheckedValues('al'),
    });
}

function normalizeRuntime(runtime) {
    return {
        sandbox: parseRuntimeValues(runtime.sandbox),
        permissions: parseRuntimeValues(runtime.permissions),
    };
}

function parseRuntimeValues(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    return value ? String(value).split(',').filter(Boolean) : [];
}

function getCheckedValues(name) {
    return Array.from(
        document.querySelectorAll(`input[name="${name}"]:checked`)
    ).map((checkbox) => checkbox.value);
}

function buildCacheKey(fileId) {
    return `${window.location.pathname}?file=${encodeURIComponent(fileId)}`;
}

function buildRuntimeQuery(fileId, runtime) {
    const params = new URLSearchParams();
    params.set('file', fileId);

    if (runtime.sandbox.length > 0) {
        params.set('sb', runtime.sandbox.join(','));
    }

    if (runtime.permissions.length > 0) {
        params.set('al', runtime.permissions.join(','));
    }

    return `?${params.toString()}`;
}

function launchRuntime(blobUrl, runtime) {
    closeRuntime();

    elements.mainUi.classList.add('hidden');
    document.body.style.padding = '0';

    const iframe = document.createElement('iframe');
    iframe.id = 'runtime-iframe';
    iframe.src = blobUrl;
    iframe.className = 'fullscreen-iframe';

    applySandbox(iframe, runtime.sandbox);
    applyPermissionsPolicy(iframe, runtime.permissions);

    document.body.appendChild(iframe);

    state.currentBlobUrl = blobUrl;
    state.runtimeFrame = iframe;
    state.currentRuntime = runtime;
}

function applySandbox(iframe, sandboxTokens) {
    iframe.setAttribute('sandbox', sandboxTokens.join(' '));
}

function applyPermissionsPolicy(iframe, permissions) {
    if (permissions.length === 0) {
        iframe.removeAttribute('allow');
        return;
    }

    iframe.setAttribute('allow', permissions.join('; '));
}

function closeRuntime() {
    if (state.runtimeFrame) {
        state.runtimeFrame.remove();
        state.runtimeFrame = null;
    }

    if (state.currentBlobUrl) {
        URL.revokeObjectURL(state.currentBlobUrl);
        state.currentBlobUrl = null;
    }

    state.currentRuntime = null;
    elements.mainUi.classList.remove('hidden');
    document.body.style.padding = '';
}

function releaseRuntime() {
    closeRuntime();
}

function isHtmlFile(file) {
    const fileName = file.name.toLowerCase();

    return (
        file.type === 'text/html' ||
        fileName.endsWith('.html') ||
        fileName.endsWith('.htm')
    );
}

function handleFileSelection(event) {
    const file = event.target.files?.[0];

    if (file) {
        processFile(file);
    }
}

function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.dropZone.classList.add('drag-active');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.dropZone.classList.remove('drag-active');
}

function handleFileDrop(event) {
    const file = event.dataTransfer.files?.[0];

    if (file) {
        processFile(file);
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
}

function hideError() {
    elements.errorMessage.classList.add('hidden');
    elements.errorMessage.textContent = '';
}
