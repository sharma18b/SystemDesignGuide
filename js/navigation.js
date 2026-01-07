// Navigation and Routing
const categories = [
    {
        id: 'social-feeds',
        folder: '01-social-feeds',
        title: 'Social Feeds & Content Platforms',
        icon: '📱',
        description: 'Social media platforms, content sharing, and community-driven applications',
        problems: 5,
        completed: 5,
        status: 'complete'
    },
    {
        id: 'messaging-collaboration',
        folder: '02-messaging-collaboration',
        title: 'Messaging & Real-time Collaboration',
        icon: '💬',
        description: 'Real-time communication, messaging platforms, and collaborative tools',
        problems: 5,
        completed: 5,
        status: 'complete'
    },
    {
        id: 'ecommerce-payments',
        folder: '03-ecommerce-payments',
        title: 'E-commerce, Payments & Logistics',
        icon: '🛒',
        description: 'Transaction processing, inventory management, and order fulfillment',
        problems: 5,
        completed: 5,
        status: 'complete'
    },
    {
        id: 'infrastructure-storage',
        folder: '04-infrastructure-storage',
        title: 'Core Infrastructure & Storage',
        icon: '🏗️',
        description: 'Fundamental building blocks for distributed systems',
        problems: 5,
        completed: 5,
        status: 'complete'
    },
    {
        id: 'events-queues',
        folder: '05-events-queues',
        title: 'Events, Queues & Rate Limiting',
        icon: '⚡',
        description: 'Event-driven systems, asynchronous processing, and traffic management',
        problems: 5,
        completed: 5,
        status: 'complete'
    },
    {
        id: 'data-analytics',
        folder: '06-data-analytics',
        title: 'Data, Analytics & Logging',
        icon: '📊',
        description: 'Big data processing, analytics platforms, and monitoring systems',
        problems: 5,
        completed: 5,
        status: 'complete'
    },
    {
        id: 'coordination-consistency',
        folder: '07-coordination-consistency',
        title: 'IDs, Consistency & Coordination',
        icon: '🔄',
        description: 'Distributed algorithms, consistency mechanisms, and coordination services',
        problems: 5,
        completed: 5,
        status: 'complete'
    },
    {
        id: 'advanced-systems',
        folder: '08-advanced-systems',
        title: 'Boss Fight Level Problems',
        icon: '🎯',
        description: 'Complex multi-domain systems requiring advanced architectural thinking',
        problems: 5,
        completed: 5,
        status: 'complete'
    }
];

// Render categories on homepage
function renderCategories() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;
    
    grid.innerHTML = categories.map(category => {
        const percentage = (category.completed / category.problems * 100).toFixed(0);
        const statusClass = `status-${category.status}`;
        const statusText = category.status === 'complete' ? '✅ Complete' : 
                          category.status === 'progress' ? '🔄 In Progress' : 
                          '⏳ Pending';
        
        return `
            <div class="category-card" onclick="navigateToCategory('${category.id}')">
                <div class="category-header">
                    <div class="category-icon">${category.icon}</div>
                    <h3 class="category-title">${category.title}</h3>
                </div>
                <p class="category-description">${category.description}</p>
                <div class="category-meta">
                    <span class="category-status ${statusClass}">${statusText}</span>
                    <span class="category-problems">${category.problems} Problems</span>
                </div>
                <div class="category-progress-bar">
                    <div class="category-progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="category-progress-text">${category.completed}/${category.problems} problems completed</div>
            </div>
        `;
    }).join('');
}

// Navigate to category page
function navigateToCategory(categoryId) {
    window.location.href = `category.html?id=${categoryId}`;
}

// Navigate to problem page
function navigateToProblem(categoryId, problemId) {
    window.location.href = `problem.html?category=${categoryId}&problem=${problemId}`;
}

// Get category by ID
function getCategoryById(id) {
    return categories.find(cat => cat.id === id);
}

// Export for use in other scripts
window.navigationData = {
    categories,
    renderCategories,
    navigateToCategory,
    navigateToProblem,
    getCategoryById
};
