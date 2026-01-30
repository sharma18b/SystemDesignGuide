/**
 * Ad Blocker Detection and Content Restriction
 * Detects ad blockers and restricts content access
 */
(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        checkDelay: 100,        // Initial check delay (ms)
        recheckDelay: 2000,     // Recheck delay for slower ad blockers (ms)
        enableLogging: false    // Set to true for debugging
    };
    
    // Logging utility
    function log(message) {
        if (CONFIG.enableLogging) {
            console.log('[AdBlock Detector]', message);
        }
    }
    
    /**
     * Create bait element that ad blockers will hide/remove
     * Uses multiple class names that ad blockers typically target
     */
    function createBait() {
        const bait = document.createElement('div');
        bait.className = 'ad ads adsbox doubleclick ad-placement ad-placeholder adbadge BannerAd';
        bait.style.cssText = 'width: 1px !important; height: 1px !important; position: absolute !important; left: -10000px !important; top: -1000px !important;';
        bait.innerHTML = '&nbsp;';
        document.body.appendChild(bait);
        log('Bait element created');
        return bait;
    }
    
    /**
     * Check if ad blocker is active using multiple detection methods
     */
    function detectAdBlock(callback) {
        const bait = createBait();
        
        setTimeout(function() {
            let isBlocked = false;
            
            // Method 1: Check if bait element was hidden or removed
            const baitHidden = bait.offsetParent === null || 
                              bait.offsetHeight === 0 || 
                              bait.offsetLeft === 0 || 
                              bait.offsetWidth === 0 ||
                              bait.clientHeight === 0;
            
            // Method 2: Check computed styles
            const computedStyle = window.getComputedStyle(bait);
            const styleHidden = computedStyle.display === 'none' || 
                               computedStyle.visibility === 'hidden';
            
            // Method 3: Check if AdSense script loaded
            const adsenseBlocked = typeof window.adsbygoogle === 'undefined';
            
            isBlocked = baitHidden || styleHidden || adsenseBlocked;
            
            log('Detection results:');
            log('- Bait hidden: ' + baitHidden);
            log('- Style hidden: ' + styleHidden);
            log('- AdSense blocked: ' + adsenseBlocked);
            log('- Final result: ' + (isBlocked ? 'BLOCKED' : 'NOT BLOCKED'));
            
            // Clean up bait element
            if (bait.parentNode) {
                document.body.removeChild(bait);
            }
            
            callback(isBlocked);
        }, CONFIG.checkDelay);
    }
    
    /**
     * Show ad blocker warning overlay and restrict content
     */
    function showAdBlockMessage() {
        log('Showing ad blocker message');
        
        // Prevent multiple overlays
        if (document.getElementById('adblock-overlay')) {
            return;
        }
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'adblock-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
            animation: fadeIn 0.3s ease-in-out;
        `;
        
        // Create message box
        const messageBox = document.createElement('div');
        messageBox.style.cssText = `
            background: white;
            padding: 3rem;
            border-radius: 16px;
            max-width: 500px;
            margin: 1rem;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideUp 0.4s ease-out;
        `;
        
        messageBox.innerHTML = `
            <div style="font-size: 4rem; margin-bottom: 1rem;">🚫</div>
            <h2 style="color: #333; margin-bottom: 1rem; font-size: 1.75rem; font-weight: 700;">Ad Blocker Detected</h2>
            <p style="color: #666; margin-bottom: 1.5rem; line-height: 1.6; font-size: 1rem;">
                We've detected that you're using an ad blocker. This website is free and supported by ads.
                Please disable your ad blocker to continue accessing our content.
            </p>
            <div style="background: #f5f5f5; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <p style="color: #333; font-size: 0.9rem; margin: 0; line-height: 1.5;">
                    <strong>Why we ask:</strong> Ads help us maintain this free resource with 400+ system design files and keep it accessible to everyone.
                </p>
            </div>
            <button id="refresh-btn" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 1rem 2.5rem;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(102, 126, 234, 0.5)';" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)';">
                I've Disabled My Ad Blocker
            </button>
            <p style="color: #999; font-size: 0.85rem; margin-top: 1rem; margin-bottom: 0;">
                After disabling, click the button above to reload the page
            </p>
        `;
        
        overlay.appendChild(messageBox);
        
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(30px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(overlay);
        
        // Blur and disable main content
        document.body.style.overflow = 'hidden';
        document.querySelectorAll('body > *:not(#adblock-overlay)').forEach(el => {
            el.style.filter = 'blur(8px)';
            el.style.pointerEvents = 'none';
            el.style.userSelect = 'none';
        });
        
        // Refresh button handler
        document.getElementById('refresh-btn').addEventListener('click', function() {
            log('Refresh button clicked');
            location.reload();
        });
        
        // Prevent right-click and keyboard shortcuts
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
        
        document.addEventListener('keydown', function(e) {
            // Prevent Ctrl/Cmd shortcuts
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                return false;
            }
            // Prevent F12 (DevTools)
            if (e.keyCode === 123) {
                e.preventDefault();
                return false;
            }
        });
    }
    
    /**
     * Handle detection result
     */
    function handleDetection(isBlocked) {
        if (isBlocked) {
            log('Ad blocker detected - showing message');
            showAdBlockMessage();
        } else {
            log('No ad blocker detected - allowing access');
        }
    }
    
    /**
     * Initialize detection
     */
    function init() {
        log('Initializing ad blocker detection');
        
        // First check
        detectAdBlock(handleDetection);
        
        // Recheck after delay (for slower ad blockers)
        setTimeout(function() {
            detectAdBlock(handleDetection);
        }, CONFIG.recheckDelay);
    }
    
    // Run detection when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
