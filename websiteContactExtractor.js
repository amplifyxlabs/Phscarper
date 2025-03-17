// Website Contact Extractor Module
const cheerio = require('cheerio');
const { delay, randomDelay, isValidUrl } = require('./utils');

/**
 * Extract contact information from a product website
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} websiteUrl - URL of the product website
 * @returns {Object} - Contact information (email, twitter, linkedin, website)
 */
async function extractWebsiteContactInfo(browser, websiteUrl) {
  if (!websiteUrl || !isValidUrl(websiteUrl)) {
    console.log(`Invalid website URL: ${websiteUrl}`);
    return { email: '', twitter: '', linkedin: '', website: '' };
  }

  console.log(`Extracting contact info from website: ${websiteUrl}`);
  
  // Create a new page
  const page = await browser.newPage();
  
  // Configure the page to appear more like a real browser
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  // Set viewport to a common desktop resolution
  await page.setViewport({
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
  });
  
  // Set accept language header
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'sec-ch-ua': '"Chromium";v="122", "Google Chrome";v="122", "Not(A:Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"'
  });
  
  // Set cookies to appear more like a real user
  await page.setCookie({
    name: 'visited_before',
    value: 'true',
    domain: new URL(websiteUrl).hostname,
    path: '/',
  });
  
  // Set timeouts
  await page.setDefaultNavigationTimeout(60000);
  await page.setDefaultTimeout(60000);
  
  try {
    // Set a timeout for the entire operation
    const timeout = 60000; // 60 seconds
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Website navigation timed out')), timeout)
    );
    
    // Try to navigate to the website with retries
    let navigationSuccessful = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!navigationSuccessful && retryCount < maxRetries) {
      try {
        // Different wait conditions for each retry
        let waitUntil;
        if (retryCount === 0) {
          waitUntil = 'networkidle2'; // Most complete loading
        } else if (retryCount === 1) {
          waitUntil = 'networkidle0'; // Less strict loading
        } else {
          waitUntil = 'domcontentloaded'; // Minimal loading, just DOM
        }
        
        console.log(`Navigation attempt ${retryCount + 1}/${maxRetries} with wait condition: ${waitUntil}`);
        
        // Navigate to the website
        const navigationPromise = page.goto(websiteUrl, {
          waitUntil: waitUntil,
          timeout: 45000
        });
        
        // Race between navigation and timeout
        await Promise.race([navigationPromise, timeoutPromise]);
        
        // If we get here, navigation was successful
        navigationSuccessful = true;
        console.log(`Successfully loaded website: ${websiteUrl}`);
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`Navigation attempt ${retryCount} failed: ${error.message}. Retrying...`);
          await delay(2000); // Wait before retrying
        } else {
          throw error; // Rethrow the error after all retries fail
        }
      }
    }
    
    // Check for common anti-bot measures
    const isCaptchaPresent = await page.evaluate(() => {
      // Check for common CAPTCHA patterns
      const pageText = document.body.innerText.toLowerCase();
      const htmlContent = document.body.innerHTML.toLowerCase();
      
      return pageText.includes('captcha') || 
             pageText.includes('robot') || 
             pageText.includes('human verification') ||
             pageText.includes('are you a robot') ||
             pageText.includes('prove you are human') ||
             pageText.includes('security check') ||
             htmlContent.includes('recaptcha') ||
             htmlContent.includes('hcaptcha') ||
             htmlContent.includes('cloudflare') ||
             document.querySelector('iframe[src*="captcha"]') !== null ||
             document.querySelector('iframe[src*="recaptcha"]') !== null ||
             document.querySelector('iframe[src*="hcaptcha"]') !== null;
    });
    
    if (isCaptchaPresent) {
      console.log('CAPTCHA or anti-bot measure detected. Extraction may be limited.');
      // Take a screenshot for debugging
      await page.screenshot({ path: `captcha_${new URL(websiteUrl).hostname}.png` });
    }
    
    // Check if we were blocked or redirected to an error page
    const isBlocked = await page.evaluate(() => {
      const pageText = document.body.innerText.toLowerCase();
      const currentUrl = window.location.href;
      
      return pageText.includes('access denied') || 
             pageText.includes('403 forbidden') ||
             pageText.includes('404 not found') ||
             pageText.includes('blocked') ||
             pageText.includes('your ip has been blocked') ||
             pageText.includes('too many requests') ||
             pageText.includes('rate limited') ||
             currentUrl.includes('error') ||
             currentUrl.includes('blocked') ||
             currentUrl.includes('denied');
    });
    
    if (isBlocked) {
      console.log('Access appears to be blocked or page not found. Extraction may fail.');
      // Take a screenshot for debugging
      await page.screenshot({ path: `blocked_${new URL(websiteUrl).hostname}.png` });
    }
    
    // Wait for the page to fully load
    await delay(2000);
    
    // First extract contact info from the initial page load
    let initialContactInfo = await extractContactInfoFromPage(page);
    
    // Then scroll to the bottom of the page to load the footer
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    // Wait longer for any lazy-loaded content to appear
    await delay(3000);
    
    // Extract contact info again after scrolling
    let footerContactInfo = await extractContactInfoFromPage(page);
    
    // Merge the results, preferring non-empty values from footerContactInfo
    const mergedContactInfo = {
      email: footerContactInfo.email || initialContactInfo.email || '',
      twitter: footerContactInfo.twitter || initialContactInfo.twitter || '',
      linkedin: footerContactInfo.linkedin || initialContactInfo.linkedin || '',
      website: footerContactInfo.website || initialContactInfo.website || ''
    };
    
    return mergedContactInfo;
  } catch (error) {
    console.error(`Error extracting website contact info: ${error.message}`);
    
    // Try to determine the type of error for better debugging
    let errorType = 'unknown';
    if (error.message.includes('timeout')) {
      errorType = 'timeout';
    } else if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      errorType = 'connection_refused';
    } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      errorType = 'dns_error';
    } else if (error.message.includes('net::ERR_ABORTED')) {
      errorType = 'aborted';
    } else if (error.message.includes('net::ERR_CERT_')) {
      errorType = 'ssl_error';
    } else if (error.message.includes('Navigation')) {
      errorType = 'navigation_error';
    }
    
    console.log(`Error type: ${errorType}`);
    
    // Try to take a screenshot of the error state if possible
    try {
      await page.screenshot({ path: `error_${errorType}_${new URL(websiteUrl).hostname}.png` });
    } catch (screenshotError) {
      console.log(`Could not take error screenshot: ${screenshotError.message}`);
    }
    
    return { email: '', twitter: '', linkedin: '', website: '' };
  } finally {
    // Always close the page to free up resources
    await page.close();
  }
}

/**
 * Extract contact info from the current page state
 * @param {Object} page - Puppeteer page object
 * @returns {Object} - Contact information
 */
async function extractContactInfoFromPage(page) {
  // Get the HTML content
  const content = await page.content();
  const $ = cheerio.load(content);
  
  // Initialize contact info
  let email = '';
  let twitter = '';
  let linkedin = '';
  let website = '';
  
  // Look for footer sections
  const footerSelectors = [
    'footer', 
    '[class*="footer"]', 
    '#footer', 
    '.footer', 
    '[id*="footer"]',
    '[class*="Footer"]',
    '.bottom',
    '.contact',
    '.social',
    '[class*="social"]',
    '[class*="contact"]',
    '.links',
    '.connect',
    '.follow-us',
    '.follow',
    '.legal',
    // Additional selectors for common footer patterns
    '[class*="bottom-section"]',
    '[class*="site-info"]',
    '[class*="site-footer"]',
    '[class*="main-footer"]',
    '[class*="page-footer"]',
    '[class*="global-footer"]',
    '[class*="site-bottom"]',
    '[class*="copyright"]',
    '[class*="socials"]',
    '[class*="social-links"]',
    '[class*="social-media"]',
    '[class*="social-icons"]',
    '[class*="contact-info"]',
    '[class*="contact-us"]',
    '[class*="get-in-touch"]',
    // Additional common contact section selectors
    '#contact',
    '.contact-section',
    '.contact-container',
    '.contact-details',
    '.contact-information',
    '.contact-form-container',
    '.contact-wrapper',
    '.contact-block',
    '.contact-area',
    '.contact-content',
    '.contact-box',
    '.contact-card',
    '.contact-panel',
    '.contact-module',
    '.contact-component',
    '.contact-element',
    '.contact-widget',
    '.contact-unit',
    '.contact-segment',
    '.contact-division',
    '.contact-part',
    '.contact-piece',
    '.contact-fragment',
    '.contact-chunk',
    '.contact-slice',
    '.contact-portion',
    '.contact-section',
    '.contact-bit',
    '.contact-item',
    '.contact-entry',
    '.contact-record',
    '.contact-listing',
    '.contact-detail',
    '.contact-info-item',
    '.contact-info-entry',
    '.contact-info-record',
    '.contact-info-listing',
    '.contact-info-detail'
  ];
  
  // First try to find links in the footer
  let socialLinks = [];
  
  footerSelectors.forEach(selector => {
    const footerElement = $(selector);
    if (footerElement.length > 0) {
      console.log(`Found footer element with selector: ${selector}`);
      // Find all links in the footer
      const links = footerElement.find('a');
      links.each((_, link) => {
        socialLinks.push($(link));
      });
    }
  });
  
  // If no links found in footer, look throughout the page
  if (socialLinks.length === 0) {
    console.log('No footer links found, searching entire page');
    const allLinks = $('a');
    allLinks.each((_, link) => {
      socialLinks.push($(link));
    });
  }
  
  console.log(`Found ${socialLinks.length} links to process`);
  
  // Process all links
  for (const link of socialLinks) {
    const href = link.attr('href');
    const text = link.text().toLowerCase();
    const html = link.html() || '';
    
    if (!href) continue;
    
    // Check for email links
    if (href.startsWith('mailto:') && !email) {
      email = href.replace('mailto:', '').trim().split('?')[0]; // Remove any parameters
      console.log(`Found email: ${email}`);
    }
    
    // Check for Twitter/X links
    if ((href.includes('twitter.com') || href.includes('x.com') || 
         text.includes('twitter') || text.includes('x.com') ||
         html.includes('twitter') || html.includes('x-twitter') ||
         html.includes('fa-twitter') || html.includes('icon-twitter') ||
         html.includes('twitter-icon') || html.includes('twitter-logo') ||
         html.includes('twitter.svg') || html.includes('x.svg') ||
         html.includes('x-logo') || html.includes('x-icon')) && !twitter) {
      twitter = extractSocialHandle(href, ['twitter.com', 'x.com']);
      console.log(`Found Twitter: ${twitter}`);
    }
    
    // Check for LinkedIn links
    if ((href.includes('linkedin.com') || text.includes('linkedin') ||
         html.includes('linkedin') || html.includes('fa-linkedin') ||
         html.includes('icon-linkedin') || html.includes('linkedin-icon') ||
         html.includes('linkedin-logo') || html.includes('linkedin.svg')) && !linkedin) {
      linkedin = href;
      console.log(`Found LinkedIn: ${linkedin}`);
    }
    
    // Check for other website links that might be contact pages
    if ((href.includes('/contact') || 
         href.includes('/about') || 
         href.includes('/support') || 
         href.includes('/help') || 
         text.includes('contact') || 
         text.includes('get in touch') || 
         text.includes('reach out') || 
         text.includes('support')) && !website) {
      // Make sure it's a full URL
      if (href.startsWith('http')) {
        website = href;
      } else if (href.startsWith('/')) {
        // Relative URL, convert to absolute
        try {
          const urlObj = new URL(page.url());
          website = `${urlObj.origin}${href}`;
        } catch (error) {
          console.error(`Error creating absolute URL: ${error.message}`);
          website = href; // Use the relative URL as fallback
        }
      }
      console.log(`Found contact page: ${website}`);
    }
  }
  
  // If email not found in links, look for it in text
  if (!email) {
    const pageText = $('body').text();
    // Improved email regex that better handles boundaries and common patterns
    const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi;
    const emailMatches = pageText.match(emailRegex);
    
    if (emailMatches && emailMatches.length > 0) {
      // Filter out common false positives
      const filteredEmails = emailMatches.filter(email => {
        return !email.includes('example.com') && 
               !email.includes('yourdomain.com') && 
               !email.includes('domain.com') && 
               !email.includes('email@') && 
               !email.includes('user@') &&
               !email.includes('username@') &&
               !email.includes('name@') &&
               !email.includes('your@') &&
               !email.includes('someone@') &&
               !email.includes('john.doe@') &&
               !email.includes('jane.doe@') &&
               !email.includes('test@');
      });
      
      if (filteredEmails.length > 0) {
        // Prioritize business emails over generic ones
        const businessEmails = filteredEmails.filter(email => 
          !email.toLowerCase().includes('gmail.com') && 
          !email.toLowerCase().includes('yahoo.com') && 
          !email.toLowerCase().includes('hotmail.com') && 
          !email.toLowerCase().includes('outlook.com') && 
          !email.toLowerCase().includes('icloud.com') && 
          !email.toLowerCase().includes('aol.com') && 
          !email.toLowerCase().includes('protonmail.com') && 
          !email.toLowerCase().includes('mail.com')
        );
        
        if (businessEmails.length > 0) {
          // Prioritize contact/info/hello emails
          const priorityEmails = businessEmails.filter(email => 
            email.toLowerCase().includes('contact@') || 
            email.toLowerCase().includes('info@') || 
            email.toLowerCase().includes('hello@') || 
            email.toLowerCase().includes('support@') || 
            email.toLowerCase().includes('help@')
          );
          
          email = priorityEmails.length > 0 ? priorityEmails[0] : businessEmails[0];
        } else {
          email = filteredEmails[0];
        }
        
        console.log(`Found email in text: ${email}`);
      }
    }
    
    // Also look for email in specific elements that commonly contain contact info
    if (!email) {
      const contactElements = $('[class*="contact"], [class*="email"], [id*="contact"], [id*="email"], [data-contact], [data-email]');
      contactElements.each((_, element) => {
        if (email) return; // Skip if we already found an email
        
        const text = $(element).text();
        const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
        if (emailMatch && emailMatch[1]) {
          email = emailMatch[1];
          console.log(`Found email in contact element: ${email}`);
        }
      });
    }
  }
  
  // Try to find social media links by looking for SVG icons or common classes
  if (!twitter || !linkedin) {
    console.log('Looking for social media icons...');
    
    // Use page.evaluate to find social media icons
    const iconSocialInfo = await page.evaluate(() => {
      const result = { twitter: '', linkedin: '' };
      
      // Look for elements that might contain social media icons
      const potentialSocialElements = Array.from(document.querySelectorAll('a, button, div, span, i'));
      
      for (const element of potentialSocialElements) {
        const html = element.outerHTML.toLowerCase();
        const href = element.getAttribute('href') || '';
        const className = element.className || '';
        
        // Check for Twitter/X
        if (!result.twitter && 
            (html.includes('twitter') || 
             html.includes('x-twitter') || 
             html.includes('fa-twitter') || 
             html.includes('icon-twitter') ||
             html.includes('twitter-icon') ||
             html.includes('twitter-logo') ||
             html.includes('twitter.svg') ||
             html.includes('x.svg') ||
             html.includes('x-logo') ||
             html.includes('x-icon') ||
             className.includes('twitter') ||
             className.includes('x-twitter') ||
             href.includes('twitter.com') ||
             href.includes('x.com'))) {
          
          if (element.tagName === 'A' && element.href) {
            result.twitter = element.href;
          } else {
            // Try to find parent or child link
            const parentLink = element.closest('a');
            const childLink = element.querySelector('a');
            
            if (parentLink && parentLink.href) {
              result.twitter = parentLink.href;
            } else if (childLink && childLink.href) {
              result.twitter = childLink.href;
            }
          }
        }
        
        // Check for LinkedIn
        if (!result.linkedin && 
            (html.includes('linkedin') || 
             html.includes('fa-linkedin') || 
             html.includes('icon-linkedin') ||
             html.includes('linkedin-icon') ||
             html.includes('linkedin-logo') ||
             html.includes('linkedin.svg') ||
             className.includes('linkedin') ||
             href.includes('linkedin.com'))) {
          
          if (element.tagName === 'A' && element.href) {
            result.linkedin = element.href;
          } else {
            // Try to find parent or child link
            const parentLink = element.closest('a');
            const childLink = element.querySelector('a');
            
            if (parentLink && parentLink.href) {
              result.linkedin = parentLink.href;
            } else if (childLink && childLink.href) {
              result.linkedin = childLink.href;
            }
          }
        }
      }
      
      return result;
    });
    
    // Update social info with icon results
    if (iconSocialInfo.twitter && !twitter) {
      twitter = extractSocialHandle(iconSocialInfo.twitter, ['twitter.com', 'x.com']);
      console.log(`Found Twitter from icon: ${twitter}`);
    }
    
    if (iconSocialInfo.linkedin && !linkedin) {
      linkedin = iconSocialInfo.linkedin;
      console.log(`Found LinkedIn from icon: ${linkedin}`);
    }
  }
  
  // If still no contact info found, try using JavaScript to extract from the page
  if (!email && !twitter && !linkedin && !website) {
    console.log('No contact info found with HTML parsing, trying JavaScript extraction...');
    
    // Use page.evaluate to find contact info
    const jsContactInfo = await page.evaluate(() => {
      const result = { email: '', twitter: '', linkedin: '', website: '' };
      
      // Look for email addresses in the page
      const emailRegex = /\b([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)\b/gi;
      const pageText = document.body.innerText;
      const emailMatches = pageText.match(emailRegex);
      
      if (emailMatches && emailMatches.length > 0) {
        result.email = emailMatches[0];
      }
      
      // Look for social links
      const links = Array.from(document.querySelectorAll('a[href]'));
      
      for (const link of links) {
        const href = link.href.toLowerCase();
        
        if (href.includes('twitter.com') || href.includes('x.com')) {
          result.twitter = href;
        } else if (href.includes('linkedin.com')) {
          result.linkedin = href;
        } else if (href.includes('contact') || link.innerText.toLowerCase().includes('contact')) {
          result.website = href;
        }
      }
      
      // Try to extract email from data attributes
      const elementsWithDataEmail = document.querySelectorAll('[data-email], [data-mail]');
      for (const element of elementsWithDataEmail) {
        const dataEmail = element.getAttribute('data-email') || element.getAttribute('data-mail');
        if (dataEmail && dataEmail.includes('@') && !result.email) {
          result.email = dataEmail;
          break;
        }
      }
      
      return result;
    });
    
    // Update contact info with JavaScript results
    if (jsContactInfo.email && !email) {
      email = jsContactInfo.email;
      console.log(`Found email with JavaScript: ${email}`);
    }
    
    if (jsContactInfo.twitter && !twitter) {
      twitter = extractSocialHandle(jsContactInfo.twitter, ['twitter.com', 'x.com']);
      console.log(`Found Twitter with JavaScript: ${twitter}`);
    }
    
    if (jsContactInfo.linkedin && !linkedin) {
      linkedin = jsContactInfo.linkedin;
      console.log(`Found LinkedIn with JavaScript: ${linkedin}`);
    }
    
    if (jsContactInfo.website && !website) {
      website = jsContactInfo.website;
      console.log(`Found contact page with JavaScript: ${website}`);
    }
  }
  
  // Try one more approach - look for common patterns in the DOM
  if (!email || !twitter || !linkedin) {
    console.log('Trying additional DOM patterns for contact info...');
    
    const domContactInfo = await page.evaluate(() => {
      const result = { email: '', twitter: '', linkedin: '' };
      
      // Check for obfuscated emails (common technique to avoid scrapers)
      const scriptTags = document.querySelectorAll('script');
      for (const script of scriptTags) {
        const content = script.textContent || '';
        if (content.includes('mailto:') || content.includes('@')) {
          const emailMatch = content.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
          if (emailMatch && emailMatch[1] && !result.email) {
            result.email = emailMatch[1];
            break;
          }
        }
      }
      
      // Look for social media in list items (common pattern in footers)
      const listItems = document.querySelectorAll('li');
      for (const item of listItems) {
        const text = item.textContent.toLowerCase();
        const html = item.innerHTML.toLowerCase();
        
        // Check for links inside the list item
        const link = item.querySelector('a');
        if (link && link.href) {
          if ((text.includes('twitter') || html.includes('twitter') || 
               link.href.includes('twitter.com') || link.href.includes('x.com')) && 
              !result.twitter) {
            result.twitter = link.href;
          } else if ((text.includes('linkedin') || html.includes('linkedin') || 
                     link.href.includes('linkedin.com')) && 
                    !result.linkedin) {
            result.linkedin = link.href;
          }
        }
      }
      
      return result;
    });
    
    // Update with DOM pattern results
    if (domContactInfo.email && !email) {
      email = domContactInfo.email;
      console.log(`Found email from DOM patterns: ${email}`);
    }
    
    if (domContactInfo.twitter && !twitter) {
      twitter = extractSocialHandle(domContactInfo.twitter, ['twitter.com', 'x.com']);
      console.log(`Found Twitter from DOM patterns: ${twitter}`);
    }
    
    if (domContactInfo.linkedin && !linkedin) {
      linkedin = domContactInfo.linkedin;
      console.log(`Found LinkedIn from DOM patterns: ${linkedin}`);
    }
  }
  
  // Try to extract email from the domain if we have a website URL
  if (!email && page.url()) {
    try {
      const urlObj = new URL(page.url());
      const domain = urlObj.hostname.replace('www.', '');
      
      // Common email patterns
      const commonEmails = [
        `info@${domain}`,
        `contact@${domain}`,
        `hello@${domain}`,
        `support@${domain}`
      ];
      
      console.log(`Trying common email patterns for domain ${domain}`);
      
      // Check if any of these emails are mentioned on the page
      const pageText = await page.evaluate(() => document.body.innerText);
      for (const potentialEmail of commonEmails) {
        if (pageText.includes(potentialEmail)) {
          email = potentialEmail;
          console.log(`Found common email pattern: ${email}`);
          break;
        }
      }
    } catch (error) {
      console.error(`Error extracting email from domain: ${error.message}`);
    }
  }
  
  return { email, twitter, linkedin, website };
}

/**
 * Extract social media handle from URL
 * @param {string} url - Social media URL
 * @param {Array} domains - Array of domains to check
 * @returns {string} - Social media handle or full URL if handle can't be extracted
 */
function extractSocialHandle(url, domains) {
  if (!url) return '';
  
  // Check if URL contains any of the domains
  const containsDomain = domains.some(domain => url.includes(domain));
  if (!containsDomain) return url;
  
  // Remove any query parameters or fragments
  url = url.split('?')[0].split('#')[0];
  
  // Remove trailing slash if present
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  
  // Extract the handle (last part of the URL)
  const parts = url.split('/');
  const handle = parts[parts.length - 1];
  
  // Validate that it looks like a social media handle
  if (handle && !handle.includes('.') && 
      !domains.some(domain => handle === domain)) {
    return handle;
  }
  
  return url;
}

module.exports = {
  extractWebsiteContactInfo
}; 