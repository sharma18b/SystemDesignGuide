// Search and Progress Tracking System

// Progress Tracking with localStorage
class ProgressTracker {
    constructor() {
        this.storageKey = 'systemDesignProgress';
        this.progress = this.loadProgress();
    }
    
    loadProgress() {
        const saved = localStorage.getItem(this.storageKey);
        return saved ? JSON.parse(saved) : {};
    }
    
    saveProgress() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.progress));
    }
    
    markFileComplete(categoryId, problemName, fileIndex) {
        const key = `${categoryId}-${problemName}`;
        if (!this.progress[key]) {
            this.progress[key] = {
                completedFiles: [],
                lastVisited: null,
                startedAt: Date.now()
            };
        }
        
        if (!this.progress[key].completedFiles.includes(fileIndex)) {
            this.progress[key].completedFiles.push(fileIndex);
        }
        this.progress[key].lastVisited = Date.now();
        this.saveProgress();
    }
    
    getProgress(categoryId, problemName) {
        const key = `${categoryId}-${problemName}`;
        return this.progress[key] || { completedFiles: [], lastVisited: null };
    }
    
    getCompletionPercentage(categoryId, problemName, totalFiles = 10) {
        const progress = this.getProgress(categoryId, problemName);
        return Math.round((progress.completedFiles.length / totalFiles) * 100);
    }
    
    getAllProgress() {
        return this.progress;
    }
    
    clearProgress() {
        this.progress = {};
        this.saveProgress();
    }
    
    exportProgress() {
        return JSON.stringify(this.progress, null, 2);
    }
    
    importProgress(jsonString) {
        try {
            this.progress = JSON.parse(jsonString);
            this.saveProgress();
            return true;
        } catch (e) {
            console.error('Failed to import progress:', e);
            return false;
        }
    }
}

// Search Functionality
class SearchEngine {
    constructor(categories) {
        this.categories = categories;
        this.searchIndex = this.buildSearchIndex();
    }
    
    buildSearchIndex() {
        const index = [];
        
        this.categories.forEach(category => {
            // Index category
            index.push({
                type: 'category',
                id: category.id,
                title: category.title,
                description: category.description,
                searchText: `${category.title} ${category.description}`.toLowerCase(),
                data: category
            });
            
            // Index problems
            if (category.problems) {
                category.problems.forEach(problem => {
                    const companies = problem.companies ? problem.companies.join(' ') : '';
                    index.push({
                        type: 'problem',
                        id: `${category.id}-${problem.name}`,
                        categoryId: category.id,
                        title: problem.title,
                        description: problem.description,
                        difficulty: problem.difficulty,
                        companies: problem.companies || [],
                        searchText: `${problem.title} ${problem.description} ${companies} ${problem.difficulty}`.toLowerCase(),
                        data: { ...problem, categoryId: category.id, categoryTitle: category.title }
                    });
                });
            }
        });
        
        return index;
    }
    
    search(query) {
        if (!query || query.trim().length === 0) {
            return [];
        }
        
        const searchTerms = query.toLowerCase().trim().split(/\s+/);
        const results = [];
        
        this.searchIndex.forEach(item => {
            let score = 0;
            let matchedTerms = 0;
            
            searchTerms.forEach(term => {
                if (item.searchText.includes(term)) {
                    matchedTerms++;
                    
                    // Title match gets higher score
                    if (item.title.toLowerCase().includes(term)) {
                        score += 10;
                    }
                    
                    // Exact match gets even higher score
                    if (item.title.toLowerCase() === term) {
                        score += 20;
                    }
                    
                    // Company match
                    if (item.companies && item.companies.some(c => c.toLowerCase().includes(term))) {
                        score += 15;
                    }
                    
                    // Difficulty match
                    if (item.difficulty && item.difficulty.toLowerCase() === term) {
                        score += 8;
                    }
                    
                    // Description match
                    if (item.description && item.description.toLowerCase().includes(term)) {
                        score += 5;
                    }
                    
                    // General match
                    score += 1;
                }
            });
            
            // Only include if all terms matched
            if (matchedTerms === searchTerms.length && score > 0) {
                results.push({ ...item, score });
            }
        });
        
        // Sort by score (highest first)
        results.sort((a, b) => b.score - a.score);
        
        return results;
    }
    
    filterByDifficulty(difficulty) {
        return this.searchIndex.filter(item => 
            item.type === 'problem' && item.difficulty === difficulty
        );
    }
    
    filterByCompany(company) {
        return this.searchIndex.filter(item => 
            item.type === 'problem' && 
            item.companies && 
            item.companies.some(c => c.toLowerCase().includes(company.toLowerCase()))
        );
    }
}

// Initialize global instances
window.progressTracker = new ProgressTracker();
window.searchEngine = null; // Will be initialized after categories load

// Helper function to format time ago
function timeAgo(timestamp) {
    if (!timestamp) return 'Never';
    
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks ago`;
    return `${Math.floor(seconds / 2592000)} months ago`;
}

// Export utilities
window.searchUtils = {
    timeAgo
};
