// Category Page Logic
document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryId = urlParams.get('id');
    
    if (!categoryId) {
        window.location.href = 'index.html';
        return;
    }
    
    const category = window.navigationData.getCategoryById(categoryId);
    if (!category) {
        window.location.href = 'index.html';
        return;
    }
    
    // Update page title and meta
    document.title = `${category.title} - System Design Study Guide`;
    
    // Update breadcrumb
    document.getElementById('category-name').textContent = category.title;
    
    // Update hero section
    document.getElementById('category-icon').textContent = category.icon;
    document.getElementById('category-title').textContent = category.title;
    document.getElementById('category-description').textContent = category.description;
    document.getElementById('problems-count').textContent = category.problems;
    document.getElementById('files-count').textContent = category.problems * 10;
    document.getElementById('time-estimate').textContent = `${(category.problems * 3.5).toFixed(1)}h`;
    
    // Load problems from README
    await loadProblems(category);
});

async function loadProblems(category) {
    try {
        const response = await fetch(`${category.folder}/README.md`);
        const markdown = await response.text();
        
        // Parse problems from markdown
        const problems = parseProblemsFromMarkdown(markdown, category);
        
        // Render problems
        renderProblems(problems, category);
    } catch (error) {
        console.error('Error loading problems:', error);
        document.getElementById('problems-grid').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                <p>Unable to load problems. Please try again later.</p>
            </div>
        `;
    }
}

function parseProblemsFromMarkdown(markdown, category) {
    const problems = [];
    
    // Extract problem sections from markdown
    const problemRegex = /###\s+\d+\.\s+(.+?)\s+\((.+?)\)\s+\*\*Folder\*\*:\s+`(.+?)`\s+\*\*Problem Statement\*\*:\s+(.+?)(?=###|\n\n##|$)/gs;
    
    let match;
    while ((match = problemRegex.exec(markdown)) !== null) {
        const [, title, status, folder, fullDescription] = match;
        
        // Extract only the description before any status markers
        // Split by common status patterns and take the first part
        let description = fullDescription
            .split(/\*\*Status\*\*:/)[0]  // Remove everything after **Status**:
            .split(/\*\*Completed Files\*\*:/)[0]  // Remove everything after **Completed Files**:
            .split(/\*\*Pending Files\*\*:/)[0]  // Remove everything after **Pending Files**:
            .trim();
        
        // Determine completion status
        let completed = 0;
        let statusType = 'pending';
        
        if (status.includes('Complete') || status.includes('✅')) {
            completed = 10;
            statusType = 'complete';
        } else if (status.includes('Progress') || status.includes('🔄')) {
            // Try to extract file count from status
            const fileMatch = status.match(/(\d+)\/10/);
            if (fileMatch) {
                completed = parseInt(fileMatch[1]);
            }
            statusType = 'progress';
        }
        
        problems.push({
            title: title.trim(),
            folder: folder.trim(),
            description: description,
            completed,
            total: 10,
            status: statusType
        });
    }
    
    return problems;
}

function renderProblems(problems, category) {
    const grid = document.getElementById('problems-grid');
    
    if (problems.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                <p>No problems found in this category.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = problems.map((problem, index) => {
        const percentage = (problem.completed / problem.total * 100).toFixed(0);
        const statusClass = `status-${problem.status}`;
        const statusText = problem.status === 'complete' ? '✅ Complete' : 
                          problem.status === 'progress' ? '🔄 In Progress' : 
                          '⏳ Pending';
        const estimatedTime = '3.5 hours';
        
        // Render markdown in description
        const renderedDescription = renderInlineMarkdown(problem.description);
        
        return `
            <div class="problem-card" onclick="navigateToProblem('${category.id}', '${problem.folder}')">
                <div class="problem-header">
                    <div>
                        <h3 class="problem-title">${problem.title}</h3>
                    </div>
                    <span class="problem-status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="problem-description">${renderedDescription}</div>
                <div class="problem-meta">
                    <div class="problem-meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>${problem.completed}/${problem.total} files</span>
                    </div>
                    <div class="problem-meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>${estimatedTime}</span>
                    </div>
                </div>
                <div class="problem-progress">
                    <div class="problem-progress-bar">
                        <div class="problem-progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="problem-progress-text">${percentage}% completed</div>
                </div>
                <div class="problem-cta">
                    <a href="problem.html?category=${category.id}&problem=${problem.folder}" class="btn-start" onclick="event.stopPropagation()">
                        ${problem.completed > 0 ? 'Continue Reading' : 'Start Reading'}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </a>
                </div>
            </div>
        `;
    }).join('');
    
    // Animate progress bars
    setTimeout(() => {
        document.querySelectorAll('.problem-progress-fill').forEach(bar => {
            const width = bar.style.width;
            bar.style.width = '0%';
            setTimeout(() => {
                bar.style.width = width;
            }, 100);
        });
    }, 100);
}

function navigateToProblem(categoryId, problemFolder) {
    window.location.href = `problem.html?category=${categoryId}&problem=${problemFolder}`;
}

// Simple inline markdown renderer for descriptions
function renderInlineMarkdown(text) {
    if (!text) return '';
    
    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to <em>
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Convert `code` to <code>
    text = text.replace(/`(.+?)`/g, '<code>$1</code>');
    
    return text;
}
