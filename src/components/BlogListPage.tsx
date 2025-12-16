import type { CSSProperties, FC } from 'react';
import { Link } from 'react-router-dom';
import './BlogListPage.css';
import { blogPosts } from '../data/blogPosts';

const BlogListPage: FC = () => {
  const featured = blogPosts[0];
  if (!featured) return null;
  const rest = blogPosts.slice(1);
  const surprise = rest[0] || featured;

  return (
    <div className="blog-list-root">
      <section
        className="blog-hero card"
        style={{ '--accent': featured.accentColor } as CSSProperties}
      >
        <div className="hero-left">
          <p className="hero-eyebrow">FitBuddy blog</p>
          <h1>Stories, tips, and lab notes for people building their streak.</h1>
          <p className="hero-dek">
            Dispatches from the team plus practical playbooks you can use today. Fresh ink,
            no fluff.
          </p>
          <div className="hero-actions">
            <Link className="hero-btn primary" to={`/blog/${featured.slug}`}>
              Read the latest
            </Link>
            <Link className="hero-btn ghost" to={`/blog/${surprise.slug}`}>
              Surprise me
            </Link>
          </div>
          <div className="hero-meta">
            <span>{featured.date}</span>
            <span aria-hidden>|</span>
            <span>{featured.readTime}</span>
            <span aria-hidden>|</span>
            <span>{featured.tags.slice(0, 2).join(' | ')}</span>
          </div>
        </div>

        <Link
          to={`/blog/${featured.slug}`}
          className="featured-card"
          style={
            {
              '--accent': featured.accentColor,
              '--masthead-gradient': featured.gradient || 'var(--gradient-primary)'
            } as CSSProperties
          }
        >
          <div className="featured-top">
            <span className="badge">{featured.heroBadge || 'Dispatch'}</span>
            <span className="pill">{featured.heroNote || 'Latest drop'}</span>
          </div>
          <h2>{featured.title}</h2>
          <p>{featured.dek}</p>
          <div className="featured-footer">
            <span>{featured.date}</span>
            <span>| {featured.readTime}</span>
          </div>
        </Link>
      </section>

      <section className="blog-grid" aria-label="All blog posts">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className={`blog-card${post.slug === featured.slug ? ' with-glow' : ''}`}
            style={
              {
                '--accent': post.accentColor,
                '--masthead-gradient': post.gradient || 'var(--gradient-primary)'
              } as CSSProperties
            }
          >
            <div className="card-top">
              <span className="badge">{post.heroBadge || 'Story'}</span>
              <span className="tag">{post.tags[0]}</span>
            </div>
            <h3>{post.title}</h3>
            <p>{post.dek}</p>
            <div className="card-meta">
              <span>{post.date}</span>
              <span aria-hidden>|</span>
              <span>{post.readTime}</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
};

export default BlogListPage;
