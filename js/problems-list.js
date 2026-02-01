// Problems List Page Logic
document.addEventListener('DOMContentLoaded', function() {
    renderAllProblems();
    setupFilters();
});

function renderAllProblems() {
    const container = document.getElementById('problems-list-container');
    
    if (!window.enhancedNavigationData || !window.enhancedNavigationData.categories) {
        container.innerHTML = '<p>Loading problems...</p>';
        return;
    }
    
    const categories = window.enhancedNavigationData.categories;
    const difficultyColors = window.enhancedNavigationData.difficultyColors;
    
    let problemNumber = 1;
    
    container.innerHTML = categories.map(category => {
        const categoryProblems = category.problems || [];
        
        return `
            <div class="category-group" data-category="${category.id}">
                <div class="category-group-header">
                    <div class="category-group-icon">${category.icon}</div>
                    <h2 class="category-group-title">${category.title}</h2>
                    <span class="category-group-count">${categoryProblems.length} problems</span>
                </div>
                <div class="category-problems">
                    ${categoryProblems.map(problem => {
                        const diffColor = difficultyColors[problem.difficulty] || difficultyColors['Medium'];
                        const progress = window.progressTracker ? 
                            window.progressTracker.getCompletionPercentage(category.id, problem.name) : 0;
                        const currentNumber = problemNumber++;
                        
                        return `
                            <div class="problem-list-item" 
                                 data-difficulty="${problem.difficulty}"
                                 data-companies="${(problem.companies || []).join(',').toLowerCase()}"
                                 data-name="${problem.title.toLowerCase()}"
                                 onclick="navigateToProblem('${category.id}', '${problem.name}')">
                                <div class="problem-number">${currentNumber}</div>
                                <div class="problem-info">
                                    <div class="problem-title-row">
                                        <span class="problem-name">${problem.title}</span>
                                        <span class="problem-difficulty-badge" style="background: ${diffColor.bg}; color: ${diffColor.text}; border-color: ${diffColor.border}">
                                            ${problem.difficulty}
                                        </span>
                                    </div>
                                    <div class="problem-companies">
                                        ${(problem.companies || []).slice(0, 5).map(company => `
                                            <span class="company-icon" title="${company}">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                                                </svg>
                                                ${company}
                                            </span>
                                        `).join('')}
                                        ${problem.companies && problem.companies.length > 5 ? 
                                            `<span class="company-icon">+${problem.companies.length - 5} more</span>` : ''}
                                    </div>
                                    <div class="problem-meta">
                                        <div class="problem-meta-item">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                            </svg>
                                            10 files
                                        </div>
                                        <div class="problem-meta-item">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <polyline points="12 6 12 12 16 14"></polyline>
                                            </svg>
                                            ~3.5 hours
                                        </div>
                                        <div class="problem-meta-item">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                <circle cx="9" cy="7" r="4"></circle>
                                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                            </svg>
                                            ${problem.companies ? problem.companies.length : 0} companies
                                        </div>
                                    </div>
                                </div>
                                ${progress > 0 ? `
                                    <div class="problem-progress-indicator">
                                        <div class="progress-circle" style="background: conic-gradient(var(--primary) ${progress * 3.6}deg, var(--bg-tertiary) 0deg)">
                                            <span>${progress}%</span>
                                        </div>
                                        <div class="progress-text">
                                            <div style="font-weight: 600; color: var(--text-primary);">In Progress</div>
                                            <div>${Math.round(progress / 10)} of 10 files</div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-pill');
    const searchInput = document.getElementById('problems-filter-input');
    
    let currentFilter = 'all';
    let currentSearch = '';
    
    // Filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            applyFilters(currentFilter, currentSearch);
        });
    });
    
    // Search input
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value.toLowerCase();
            applyFilters(currentFilter, currentSearch);
        }, 300);
    });
}

function applyFilters(difficulty, searchTerm) {
    const allItems = document.querySelectorAll('.problem-list-item');
    const categoryGroups = document.querySelectorAll('.category-group');
    
    let visibleCount = 0;
    
    categoryGroups.forEach(group => {
        const items = group.querySelectorAll('.problem-list-item');
        let visibleInGroup = 0;
        
        items.forEach(item => {
            const itemDifficulty = item.dataset.difficulty;
            const itemName = item.dataset.name;
            const itemCompanies = item.dataset.companies;
            
            const matchesDifficulty = difficulty === 'all' || itemDifficulty === difficulty;
            const matchesSearch = !searchTerm || 
                                 itemName.includes(searchTerm) || 
                                 itemCompanies.includes(searchTerm);
            
            if (matchesDifficulty && matchesSearch) {
                item.style.display = 'flex';
                visibleInGroup++;
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        // Hide category if no visible items
        if (visibleInGroup === 0) {
            group.style.display = 'none';
        } else {
            group.style.display = 'block';
        }
    });
    
    // Update filter button counts
    updateFilterCounts();
    
    // Show empty state if no results
    if (visibleCount === 0) {
        showEmptyState();
    } else {
        hideEmptyState();
    }
}

function updateFilterCounts() {
    const allItems = document.querySelectorAll('.problem-list-item');
    const counts = {
        all: allItems.length,
        Easy: 0,
        Medium: 0,
        Hard: 0,
        Expert: 0
    };
    
    allItems.forEach(item => {
        const difficulty = item.dataset.difficulty;
        if (counts[difficulty] !== undefined) {
            counts[difficulty]++;
        }
    });
    
    document.querySelectorAll('.filter-pill').forEach(button => {
        const filter = button.dataset.filter;
        if (counts[filter] !== undefined) {
            const text = filter === 'all' ? `All (${counts[filter]})` : filter;
            button.textContent = text;
        }
    });
}

function showEmptyState() {
    const container = document.getElementById('problems-list-container');
    if (!document.querySelector('.problems-empty')) {
        const emptyState = document.createElement('div');
        emptyState.className = 'problems-empty';
        emptyState.innerHTML = `
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
            <h3>No problems found</h3>
            <p>Try adjusting your filters or search term</p>
        `;
        container.appendChild(emptyState);
    }
}

function hideEmptyState() {
    const emptyState = document.querySelector('.problems-empty');
    if (emptyState) {
        emptyState.remove();
    }
}

function navigateToProblem(categoryId, problemName) {
    window.location.href = `problem.html?category=${categoryId}&problem=${problemName}`;
}
