import './Hero.css'

export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-content">
        <img src="/avatar.jpg" alt="Jorge Manuel Torre" className="hero-avatar" />
        <p className="hero-greeting">Hi, I'm</p>
        <h1 className="hero-name">Jorge Manuel Torre</h1>
        <p className="hero-role">
          <span className="mono accent">{'>'}</span> Computer Science @ Virginia Tech
        </p>
        <p className="hero-bio">
          Systems programmer and full-stack developer with a focus on low-level security,
          infrastructure, and building things that work.
        </p>
        <div className="hero-cta">
          <a href="#projects" className="btn btn-primary">View Projects</a>
          <a href="#contact" className="btn btn-ghost">Get in Touch</a>
        </div>
      </div>
    </section>
  )
}
