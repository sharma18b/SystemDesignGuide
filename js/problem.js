// Problem Page Logic
const files = [
    { name: '01-problem-statement.md', title: 'Problem Statement' },
    { name: '02-scale-constraints.md', title: 'Scale & Constraints' },
    { name: '03-architecture.md', title: 'Architecture' },
    { name: '04-database-design.md', title: 'Database Design' },
    { name: '05-api-design.md', title: 'API Design' },
    { name: '06-scaling-considerations.md', title: 'Scaling' },
    { name: '07-tradeoffs-alternatives.md', title: 'Trade-offs' },
    { name: '08-variations-followups.md', title: 'Variations' },
    { name: '09-security-privacy.md', title: 'Security & Privacy' },
    { name: '10-interview-tips.md', title: 'Interview Tips' }
];

let currentState = {
    categoryId: null,
    problemFolder: null,
    currentFileIndex: 0,
    category: null
};

document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupEventListeners();
});

function initializePage() {
    const urlParams = new URLSearchParams(window.location.search);
    currentState.categoryId = urlParams.get('category');
    currentState.problemFolder = urlParams.get('problem');
    
    if (!currentState.categoryId || !currentState.problemFolder) {
        window.location.href = 'index.html';
        return;
    }
    
    currentState.category = window.navigationData.getCategoryById(currentState.categoryId);
    if (!currentState.category) {
        window.location.href = 'index.html';
        return;
    }
    
    // Get file index from URL if specified
    const fileParam = urlParams.get('file');
    if (fileParam) {
        const fileIndex = parseInt(fileParam) - 1;
        if (fileIndex >= 0 && fileIndex < files.length) {
            currentState.currentFileIndex = fileIndex;
        }
    }
    
    // Update breadcrumb
    const breadcrumbCategory = document.getElementById('breadcrumb-category');
    breadcrumbCategory.textContent = currentState.category.title;
    breadcrumbCategory.href = `category.html?id=${currentState.categoryId}`;
    
    // Extract problem name from folder
    const problemName = currentState.problemFolder.split('/').pop().replace(/-/g, ' ');
    document.getElementById('breadcrumb-problem').textContent = capitalizeWords(problemName);
    
    // Update sidebar
    document.getElementById('sidebar-problem-title').textContent = capitalizeWords(problemName);
    
    // Render sidebar navigation
    renderSidebarNav();
    
    // Load current file
    loadCurrentFile();
}

function setupEventListeners() {
    // Previous button
    document.getElementById('prev-button').addEventListener('click', () => {
        if (currentState.currentFileIndex > 0) {
            currentState.currentFileIndex--;
            loadCurrentFile();
            updateURL();
        }
    });
    
    // Next button
    document.getElementById('next-button').addEventListener('click', () => {
        if (currentState.currentFileIndex < files.length - 1) {
            currentState.currentFileIndex++;
            loadCurrentFile();
            updateURL();
        }
    });
    
    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && currentState.currentFileIndex > 0) {
            currentState.currentFileIndex--;
            loadCurrentFile();
            updateURL();
        } else if (e.key === 'ArrowRight' && currentState.currentFileIndex < files.length - 1) {
            currentState.currentFileIndex++;
            loadCurrentFile();
            updateURL();
        }
    });
}

function renderSidebarNav() {
    const nav = document.getElementById('sidebar-nav');
    
    nav.innerHTML = files.map((file, index) => {
        const isActive = index === currentState.currentFileIndex;
        const isCompleted = index < currentState.currentFileIndex;
        
        let iconSvg;
        if (isCompleted) {
            iconSvg = `<svg class="nav-item-icon check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`;
        } else if (isActive) {
            iconSvg = `<svg class="nav-item-icon current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>`;
        } else {
            iconSvg = `<svg class="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
            </svg>`;
        }
        
        return `
            <a class="nav-item ${isActive ? 'active' : ''}" data-index="${index}">
                ${iconSvg}
                <span class="nav-item-text">${file.title}</span>
            </a>
        `;
    }).join('');
    
    // Add click handlers
    nav.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            currentState.currentFileIndex = index;
            loadCurrentFile();
            updateURL();
            
            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
            }
        });
    });
}

async function loadCurrentFile() {
    const file = files[currentState.currentFileIndex];
    
    // Build file path - problemFolder already contains just the folder name
    const filePath = `${currentState.category.folder}/${currentState.problemFolder}/${file.name}`;
    
    console.log('Category folder:', currentState.category.folder);
    console.log('Problem folder:', currentState.problemFolder);
    console.log('File name:', file.name);
    console.log('Full path:', filePath);
    
    // Update page title
    document.title = `${file.title} - System Design Study Guide`;
    
    // Update content header
    document.getElementById('content-title').textContent = file.title;
    document.getElementById('file-number').textContent = `File ${currentState.currentFileIndex + 1} of ${files.length}`;
    
    // Show loading state
    const contentElement = document.getElementById('markdown-content');
    contentElement.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
    
    // Load and render markdown
    const success = await window.loadMarkdownFile(filePath, 'markdown-content');
    
    if (success) {
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Update reading time (estimate)
        document.getElementById('reading-time').textContent = '20 min read';
    }
    
    // Update navigation buttons
    updateNavigationButtons();
    
    // Update sidebar
    renderSidebarNav();
}

function updateNavigationButtons() {
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    
    prevButton.disabled = currentState.currentFileIndex === 0;
    nextButton.disabled = currentState.currentFileIndex === files.length - 1;
    
    if (currentState.currentFileIndex > 0) {
        prevButton.querySelector('span').textContent = files[currentState.currentFileIndex - 1].title;
    }
    
    if (currentState.currentFileIndex < files.length - 1) {
        nextButton.querySelector('span').textContent = files[currentState.currentFileIndex + 1].title;
    }
}

function updateURL() {
    const url = new URL(window.location);
    url.searchParams.set('file', currentState.currentFileIndex + 1);
    window.history.pushState({}, '', url);
}

function capitalizeWords(str) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
}
