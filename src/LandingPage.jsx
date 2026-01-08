import { useScrollReveal } from './hooks/useScrollReveal.js'
import { useParallax } from './hooks/useParallax.js'
import './LandingPage.css'

/**
 * Landing Page Component
 * 
 * Luxury dark themed landing page for LAIPath
 * With scroll-based animations
 */
function LandingPage({ onGetStarted }) {
  // Scroll reveal hooks for different sections
  const sectionTitle = useScrollReveal()
  
  const step1 = useScrollReveal()
  const step2 = useScrollReveal()
  const step3 = useScrollReveal()
  
  const previewCard1 = useScrollReveal()
  const previewCard2 = useScrollReveal()
  const previewCard3 = useScrollReveal()
  
  const philosophyContent = useScrollReveal()
  const finalCtaContent = useScrollReveal()
  
  // Parallax hooks for decorative background elements
  const heroParallax = useParallax(0.15) // Slowest movement for hero
  const howItWorksParallax = useParallax(0.2)
  const previewParallax = useParallax(0.25)
  const philosophyParallax = useParallax(0.2)
  
  return (
    <div className="landing-page" style={{ width: '100%', minHeight: '100vh', display: 'block' }}>
      {/* Hero Section */}
      <section className="hero-section">
        <div ref={heroParallax} className="parallax-blob parallax-blob-hero"></div>
        <div className="hero-content">
          <h1 className="hero-headline">
            A learning system that adapts to how you actually learn.
          </h1>
          <p className="hero-subheadline">
            Daily syllabus, mandatory reflection, and a topic-scoped AI mentor that guides your progress.
          </p>
          <button className="hero-cta-primary" onClick={onGetStarted}>
            Start your learning path
          </button>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div ref={howItWorksParallax} className="parallax-blob parallax-blob-how-it-works"></div>
        <div className="section-container">
          <div className="how-it-works-flow">
            <div 
              ref={step1.ref}
              className={`flow-step scroll-reveal-step ${step1.isVisible ? 'is-visible' : ''}`}
            >
              <div className="flow-step-header">
                <div className="flow-step-number">1</div>
                <div className="flow-step-icon">🎯</div>
              </div>
              <div className="flow-step-content">
                <h3 className="flow-step-title">Set a goal</h3>
                <p className="flow-step-description">
                  Define what you want to learn and how much time you can commit daily.
                </p>
              </div>
            </div>
            <div 
              ref={step2.ref}
              className={`flow-step scroll-reveal-step ${step2.isVisible ? 'is-visible' : ''}`}
            >
              <div className="flow-step-header">
                <div className="flow-step-number">2</div>
                <div className="flow-step-icon">🤖</div>
              </div>
              <div className="flow-step-content">
                <h3 className="flow-step-title">Learn daily with AI support</h3>
                <p className="flow-step-description">
                  Receive a personalized daily syllabus and get help from a topic-scoped AI mentor.
                </p>
              </div>
            </div>
            <div 
              ref={step3.ref}
              className={`flow-step scroll-reveal-step ${step3.isVisible ? 'is-visible' : ''}`}
            >
              <div className="flow-step-header">
                <div className="flow-step-number">3</div>
                <div className="flow-step-icon">🔄</div>
              </div>
              <div className="flow-step-content">
                <h3 className="flow-step-title">Reflect → adapt → progress</h3>
                <p className="flow-step-description">
                  Complete mandatory reflection each day. Tomorrow's plan adapts based on your insights.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Preview Section */}
      <section className="preview-section">
        <div ref={previewParallax} className="parallax-blob parallax-blob-preview"></div>
        <div className="section-container">
          <h2 
            ref={sectionTitle.ref}
            className={`section-title scroll-reveal ${sectionTitle.isVisible ? 'is-visible' : ''}`}
          >
            See It In Action
          </h2>
          <div className="preview-grid">
            <div 
              ref={previewCard1.ref}
              className={`preview-card scroll-reveal ${previewCard1.isVisible ? 'is-visible' : ''}`}
            >
              <div className="preview-placeholder">
                <div className="preview-label">Today View</div>
                <div className="preview-content">
                  <div className="preview-line"></div>
                  <div className="preview-line short"></div>
                  <div className="preview-line"></div>
                </div>
              </div>
            </div>
            <div 
              ref={previewCard2.ref}
              className={`preview-card scroll-reveal ${previewCard2.isVisible ? 'is-visible' : ''}`}
            >
              <div className="preview-placeholder">
                <div className="preview-label">Calendar View</div>
                <div className="preview-content">
                  <div className="preview-line"></div>
                  <div className="preview-line short"></div>
                  <div className="preview-line"></div>
                </div>
              </div>
            </div>
            <div 
              ref={previewCard3.ref}
              className={`preview-card scroll-reveal ${previewCard3.isVisible ? 'is-visible' : ''}`}
            >
              <div className="preview-placeholder">
                <div className="preview-label">Reflection Modal</div>
                <div className="preview-content">
                  <div className="preview-line"></div>
                  <div className="preview-line short"></div>
                  <div className="preview-line"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="philosophy-section">
        <div ref={philosophyParallax} className="parallax-blob parallax-blob-philosophy"></div>
        <div className="section-container">
          <div 
            ref={philosophyContent.ref}
            className={`philosophy-content scroll-reveal ${philosophyContent.isVisible ? 'is-visible' : ''}`}
          >
            <h2 className="philosophy-title">Our Philosophy</h2>
            <p className="philosophy-text">
              LAIPath is not a chatbot or a content feed.<br />
              It's a system for intentional daily learning.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="final-cta-section">
        <div className="section-container">
          <div 
            ref={finalCtaContent.ref}
            className={`final-cta-content scroll-reveal ${finalCtaContent.isVisible ? 'is-visible' : ''}`}
          >
            <h2 className="final-cta-title">Ready to Start Your Learning Journey?</h2>
            <button className="cta-primary large" onClick={onGetStarted}>
              Start your path
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage

