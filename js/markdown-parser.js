// Markdown Parser with Syntax Highlighting
(function() {
    // Configure marked.js
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        console.error('Highlight error:', err);
                    }
                }
                return code;
            },
            breaks: true,
            gfm: true,
            headerIds: true,
            mangle: false
        });
    }
    
    // Parse markdown to HTML
    window.parseMarkdown = function(markdown) {
        if (typeof marked === 'undefined') {
            console.error('marked.js not loaded');
            return '<p>Error: Markdown parser not available</p>';
        }
        
        try {
            // Parse markdown
            let html = marked.parse(markdown);
            
            // Post-process HTML
            html = postProcessHtml(html);
            
            return html;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return '<p>Error parsing markdown content</p>';
        }
    };
    
    // Post-process HTML for better styling
    function postProcessHtml(html) {
        // Add target="_blank" to external links
        html = html.replace(/<a href="http/g, '<a target="_blank" rel="noopener noreferrer" href="http');
        
        // Add responsive table wrapper
        html = html.replace(/<table>/g, '<div class="table-wrapper"><table>');
        html = html.replace(/<\/table>/g, '</table></div>');
        
        // Add copy button to code blocks (optional enhancement)
        // html = addCopyButtonToCodeBlocks(html);
        
        return html;
    }
    
    // Render markdown content to element
    window.renderMarkdown = function(markdown, elementId) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error('Element not found:', elementId);
            return;
        }
        
        const html = window.parseMarkdown(markdown);
        element.innerHTML = html;
        
        // Highlight code blocks
        if (typeof hljs !== 'undefined') {
            element.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
        
        // Add smooth scroll to anchor links
        element.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    };
    
    // Load and render markdown file
    window.loadMarkdownFile = async function(filePath, elementId) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const markdown = await response.text();
            window.renderMarkdown(markdown, elementId);
            return true;
        } catch (error) {
            console.error('Error loading markdown file:', error);
            const element = document.getElementById(elementId);
            if (element) {
                element.innerHTML = `
                    <div class="error">
                        <div class="error-icon">📄</div>
                        <h2 class="error-title">File Not Found</h2>
                        <p class="error-message">Unable to load the requested file.</p>
                        <p style="color: var(--text-tertiary); font-size: 0.875rem;">${filePath}</p>
                    </div>
                `;
            }
            return false;
        }
    };
    
    // Calculate reading time
    window.calculateReadingTime = function(markdown) {
        const wordsPerMinute = 200;
        const words = markdown.trim().split(/\s+/).length;
        const minutes = Math.ceil(words / wordsPerMinute);
        return minutes;
    };
})();
