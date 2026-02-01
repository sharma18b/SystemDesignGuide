// UI Components for Enhanced Features

// Search Modal Component
function createSearchModal() {
    const modal = document.createElement('div');
    modal.id = 'search-modal';
    modal.className = 'search-modal';
    modal.innerHTML = `
        <div class="search-modal-overlay"></div>
        <div class="search-modal-content">
            <div class="search-header">
                <div class="search-input-wrapper">
                    <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input type="text" id="search-input" placeholder="Search problems, companies, or topics..." autocomplete="off">
                    <button class="search-close" aria-label="Close search">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="search-filters">
                    <button class="filter-btn active" data-filter="all">All</button>
                    <button class="filter-btn" data-filter="Easy">Easy</button>
                    <button class="filter-btn" data-filter="Medium">Medium</button>
                    <button class="filter-btn" data-filter="Hard">Hard</button>
                    <button class="filter-btn" data-filter="Expert">Expert</button>
                </div>
            </div>
            <div class="search-results" id="search-results">
                <div class="search-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <p>Start typing to search...</p>
                    <div class="search-suggestions">
                        <span>Try:</span>
                        <button class="suggestion-chip" data-query="google">Google</button>
                        <button class="suggestion-chip" data-query="rate limiter">Rate Limiter</button>
                        <button class="suggestion-chip" data-query="hard">Hard</button>
                    </div>
                </div>
            </div>
            <div class="search-footer">
                <div class="search-shortcuts">
                    <kbd>↑↓</kbd> Navigate
                    <kbd>Enter</kbd> Select
                    <kbd>Esc</kbd> Close
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    initializeSearchModal(modal);
}

function initializeSearchModal(modal) {
    const overlay = modal.querySelector('.search-modal-overlay');
    const closeBtn = modal.querySelector('.search-close');
    const input = modal.querySelector('#search-input');
    const resultsContainer = modal.querySelector('#search-results');
    const filterBtns = modal.querySelectorAll('.filter-btn');
    
    let currentFilter = 'all';
    let selectedIndex = -1;
    
    // Close modal
    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        input.value = '';
        selectedIndex = -1;
    }
    
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    
    // Filter buttons
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            performSearch(input.value, currentFilter);
        });
    });
    
    // Search input
    let searchTimeout;
    input.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(e.target.value, currentFilter);
        }, 200);
    });
    
    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        const results = resultsContainer.querySelectorAll('.search-result-item');
        
        if (e.key === 'Escape') {
            closeModal();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
            updateSelection(results);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateSelection(results);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            results[selectedIndex].click();
        }
    });
    
    // Suggestion chips
    modal.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            input.value = chip.dataset.query;
            performSearch(chip.dataset.query, currentFilter);
            input.focus();
        });
    });
    
    function updateSelection(results) {
        results.forEach((result, index) => {
            if (index === selectedIndex) {
                result.classList.add('selected');
                result.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                result.classList.remove('selected');
            }
        });
    }
    
    function performSearch(query, filter) {
        if (!window.searchEngine) return;
        
        let results = [];
        
        if (query.trim()) {
            results = window.searchEngine.search(query);
            
            // Apply difficulty filter
            if (filter !== 'all') {
                results = results.filter(r => r.difficulty === filter);
            }
        }
        
        renderSearchResults(results, resultsContainer);
        selectedIndex = -1;
    }
}

function renderSearchResults(results, container) {
    if (results.length === 0) {
        container.innerHTML = `
            <div class="search-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <p>No results found</p>
                <p class="search-empty-hint">Try different keywords or filters</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = results.map(result => {
        if (result.type === 'category') {
            return `
                <div class="search-result-item" onclick="navigateToCategory('${result.id}')">
                    <div class="search-result-icon">${result.data.icon}</div>
                    <div class="search-result-content">
                        <div class="search-result-title">${result.title}</div>
                        <div class="search-result-meta">${result.data.problems} problems</div>
                    </div>
                    <div class="search-result-badge">Category</div>
                </div>
            `;
        } else {
            const difficultyColor = window.enhancedNavigationData.difficultyColors[result.difficulty];
            const companies = result.companies.slice(0, 3).join(', ');
            const progress = window.progressTracker.getCompletionPercentage(result.categoryId, result.data.name);
            
            return `
                <div class="search-result-item" onclick="navigateToProblem('${result.categoryId}', '${result.data.name}')">
                    <div class="search-result-content">
                        <div class="search-result-title">${result.title}</div>
                        <div class="search-result-description">${result.description}</div>
                        <div class="search-result-meta">
                            <span class="difficulty-badge" style="background: ${difficultyColor.bg}; color: ${difficultyColor.text}; border-color: ${difficultyColor.border}">
                                ${result.difficulty}
                            </span>
                            <span class="companies-badge">${companies}</span>
                            ${progress > 0 ? `<span class="progress-badge">${progress}% complete</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');
}

// Progress Dashboard Component
function createProgressDashboard() {
    const dashboard = document.createElement('div');
    dashboard.id = 'progress-dashboard';
    dashboard.className = 'progress-dashboard';
    dashboard.innerHTML = `
        <div class="progress-dashboard-overlay"></div>
        <div class="progress-dashboard-content">
            <div class="progress-dashboard-header">
                <h2>Your Learning Progress</h2>
                <button class="progress-close" aria-label="Close">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="progress-dashboard-body" id="progress-dashboard-body">
                <!-- Content will be dynamically loaded -->
            </div>
            <div class="progress-dashboard-footer">
                <button class="btn-secondary" onclick="exportProgress()">Export Progress</button>
                <button class="btn-danger" onclick="clearProgress()">Clear All Progress</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dashboard);
    initializeProgressDashboard(dashboard);
}

function initializeProgressDashboard(dashboard) {
    const overlay = dashboard.querySelector('.progress-dashboard-overlay');
    const closeBtn = dashboard.querySelector('.progress-close');
    
    function closeDashboard() {
        dashboard.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    overlay.addEventListener('click', closeDashboard);
    closeBtn.addEventListener('click', closeDashboard);
}

function renderProgressDashboard() {
    const body = document.getElementById('progress-dashboard-body');
    const allProgress = window.progressTracker.getAllProgress();
    const entries = Object.entries(allProgress);
    
    if (entries.length === 0) {
        body.innerHTML = `
            <div class="progress-empty">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <h3>No progress yet</h3>
                <p>Start reading problems to track your progress</p>
            </div>
        `;
        return;
    }
    
    // Calculate stats
    const totalProblems = entries.length;
    const totalFiles = entries.reduce((sum, [, data]) => sum + data.completedFiles.length, 0);
    const completedProblems = entries.filter(([, data]) => data.completedFiles.length === 10).length;
    
    body.innerHTML = `
        <div class="progress-stats">
            <div class="progress-stat-card">
                <div class="progress-stat-value">${totalProblems}</div>
                <div class="progress-stat-label">Problems Started</div>
            </div>
            <div class="progress-stat-card">
                <div class="progress-stat-value">${completedProblems}</div>
                <div class="progress-stat-label">Problems Completed</div>
            </div>
            <div class="progress-stat-card">
                <div class="progress-stat-value">${totalFiles}</div>
                <div class="progress-stat-label">Files Read</div>
            </div>
        </div>
        <div class="progress-list">
            ${entries.map(([key, data]) => {
                const [categoryId, problemName] = key.split('-');
                const percentage = Math.round((data.completedFiles.length / 10) * 100);
                const lastVisited = window.searchUtils.timeAgo(data.lastVisited);
                
                return `
                    <div class="progress-item" onclick="navigateToProblem('${categoryId}', '${problemName}')">
                        <div class="progress-item-header">
                            <div class="progress-item-title">${problemName.replace(/-/g, ' ')}</div>
                            <div class="progress-item-percentage">${percentage}%</div>
                        </div>
                        <div class="progress-item-bar">
                            <div class="progress-item-fill" style="width: ${percentage}%"></div>
                        </div>
                        <div class="progress-item-meta">
                            ${data.completedFiles.length}/10 files • Last visited ${lastVisited}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Social Share Component
function createShareButtons(title, url) {
    const shareContainer = document.createElement('div');
    shareContainer.className = 'share-buttons';
    shareContainer.innerHTML = `
        <button class="share-btn share-twitter" onclick="shareOnTwitter('${title}', '${url}')" title="Share on Twitter">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
        </button>
        <button class="share-btn share-linkedin" onclick="shareOnLinkedIn('${title}', '${url}')" title="Share on LinkedIn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
        </button>
        <button class="share-btn share-copy" onclick="copyToClipboard('${url}')" title="Copy link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        </button>
    `;
    return shareContainer;
}

// Share functions
function shareOnTwitter(title, url) {
    const text = encodeURIComponent(`${title} - System Design Study Guide`);
    const shareUrl = encodeURIComponent(url);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${shareUrl}`, '_blank', 'width=550,height=420');
}

function shareOnLinkedIn(title, url) {
    const shareUrl = encodeURIComponent(url);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`, '_blank', 'width=550,height=420');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Link copied to clipboard!');
    });
}

// Toast notification
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Export/Clear progress functions
function exportProgress() {
    const data = window.progressTracker.exportProgress();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-design-progress-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Progress exported successfully!');
}

function clearProgress() {
    if (confirm('Are you sure you want to clear all progress? This cannot be undone.')) {
        window.progressTracker.clearProgress();
        renderProgressDashboard();
        showToast('Progress cleared');
    }
}

// Initialize components on page load
document.addEventListener('DOMContentLoaded', () => {
    createSearchModal();
    createProgressDashboard();
});

// Export functions
window.uiComponents = {
    renderProgressDashboard,
    createShareButtons,
    showToast
};
