// Security monitoring and validation utilities

class SecurityMonitor {
  constructor() {
    this.suspiciousActivity = []
    this.requestCount = 0
    this.lastRequestTime = Date.now()
  }

  // Monitor API requests for suspicious patterns
  monitorRequest(endpoint, data) {
    this.requestCount++
    const now = Date.now()
    const timeDiff = now - this.lastRequestTime
    
    // Rate limiting detection
    if (timeDiff < 100 && this.requestCount > 10) {
      this.logSuspiciousActivity('Rapid requests detected', {
        endpoint,
        requestCount: this.requestCount,
        timeDiff
      })
    }
    
    // Large query detection
    if (data && typeof data === 'object') {
      const queryLength = JSON.stringify(data).length
      if (queryLength > 10000) {
        this.logSuspiciousActivity('Large query detected', {
          endpoint,
          queryLength
        })
      }
    }
    
    this.lastRequestTime = now
  }

  // Log suspicious activity
  logSuspiciousActivity(type, details) {
    const activity = {
      type,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }
    
    this.suspiciousActivity.push(activity)
    
    // In production, you might want to send this to a monitoring service
    if (import.meta.env.PROD) {
      console.warn('Suspicious activity detected:', activity)
      // Send to monitoring service (e.g., Sentry, LogRocket, etc.)
    }
  }

  // Validate input to prevent injection attacks
  validateInput(input, type = 'string') {
    if (typeof input !== type) {
      this.logSuspiciousActivity('Invalid input type', { input, expectedType: type })
      return false
    }

    // SQL injection patterns (basic)
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+'.*'\s*=\s*'.*')/i
    ]

    if (typeof input === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(input)) {
          this.logSuspiciousActivity('SQL injection attempt detected', { input })
          return false
        }
      }
    }

    return true
  }

  // Sanitize input
  sanitizeInput(input) {
    if (typeof input !== 'string') return input
    
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .trim()
  }

  // Get security report
  getSecurityReport() {
    return {
      suspiciousActivityCount: this.suspiciousActivity.length,
      recentActivity: this.suspiciousActivity.slice(-10),
      requestCount: this.requestCount,
      lastActivity: this.lastRequestTime
    }
  }
}

// Create global security monitor instance
export const securityMonitor = new SecurityMonitor()

// Security middleware for API calls
export const secureApiCall = async (apiFunction, ...args) => {
  // Validate inputs
  for (const arg of args) {
    if (!securityMonitor.validateInput(arg)) {
      throw new Error('Invalid input detected')
    }
  }

  // Monitor the request
  securityMonitor.monitorRequest(apiFunction.name, args)

  // Sanitize inputs
  const sanitizedArgs = args.map(arg => 
    typeof arg === 'string' ? securityMonitor.sanitizeInput(arg) : arg
  )

  try {
    return await apiFunction(...sanitizedArgs)
  } catch (error) {
    securityMonitor.logSuspiciousActivity('API call failed', {
      function: apiFunction.name,
      error: error.message,
      args: sanitizedArgs
    })
    throw error
  }
}

export default SecurityMonitor
