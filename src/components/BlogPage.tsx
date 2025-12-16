import type { CSSProperties, FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import './BlogPage.css';
import { blogPosts, findPostBySlug, latestPost } from '../data/blogPosts';

const BlogPage: FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const article = findPostBySlug(slug) ?? latestPost;
  const suggested = blogPosts.filter((post) => post.slug !== article.slug).slice(0, 2);
  const gradientId = `blog-hero-${article.slug}`;
  const scopedClass = `blog-vars-${article.slug.replace(/[^a-z0-9-_]/gi, '-')}`;

  // Build CSS rules for the page and suggested posts to avoid inline `style` attributes
  const suggestedRules = suggested
    .map((post) => {
      const cls = `mini-vars-${post.slug.replace(/[^a-z0-9-_]/gi, '-')}`;
      const grad = post.gradient || 'var(--gradient-primary)';
      return `.${cls} { --accent: ${post.accentColor}; --masthead-gradient: ${grad}; }`;
    })
    .join('\n');

  const pageRule = `.${scopedClass} { --accent: ${article.accentColor}; --masthead-gradient: ${article.gradient || 'var(--gradient-primary)'}; }`;

  return (
    <div className={`fb-news-root ${scopedClass}`}>
      <style>{`${pageRule}\n${suggestedRules}`}</style>
      <div className="blog-nav">
        <Link className="pill-link" to="/blog" aria-label="Return to blog home">
          Back to all posts
        </Link>
        <span className="pill-link soft">{article.heroNote || 'FitBuddy dispatch'}</span>
      </div>

      <header className="fb-masthead" role="banner">
        <div className="masthead-left" aria-hidden>
          <div className="newspaper-logo">FB</div>
        </div>
        <div className="masthead-right">
          <div className="paper-eyebrow">{article.heroBadge || 'Dispatch'}</div>
          <h1 className="paper-title">{article.title}</h1>
          <div className="paper-sub">{article.dek}</div>
          <div className="paper-meta">
            <span>{article.author}</span>
            <span aria-hidden>|</span>
            <span>{article.date}</span>
            <span aria-hidden>|</span>
            <span>{article.readTime}</span>
          </div>
          <div className="tag-row">
            {article.tags.map((tag) => (
              <span className="story-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="fb-paper card" role="main">
        <section className="lead">
          <div className="hero">
            <svg
              className="mascot"
              viewBox="0 0 120 120"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor={article.accentColor} />
                  <stop offset="1" stopColor="#1e90cb" />
                </linearGradient>
              </defs>
              <rect width="120" height="120" rx="18" fill={`url(#${gradientId})`} />
              <g transform="translate(18,30) scale(0.7)">
                <circle cx="24" cy="12" r="10" fill="#fff" />
                <rect x="8" y="36" width="32" height="8" rx="4" fill="#fff" />
                <rect x="0" y="48" width="48" height="8" rx="4" fill="#fff" />
              </g>
            </svg>
            <div className="lead-text">
              <p className="lead-dek">{article.dek}</p>
              <div className="lead-kickers">
                <span className="kicker">{article.heroNote || 'Team notes'}</span>
                <span className="kicker">Updated {article.date}</span>
              </div>
            </div>
          </div>
        </section>

        <article className="story">
          {article.body.map((block, index) => {
            if (block.kind === 'paragraph') {
              return <p key={`${block.kind}-${index}`}>{block.text}</p>;
            }
            if (block.kind === 'list') {
              return (
                <div className="story-list" key={`${block.kind}-${index}`}>
                  {block.title ? <p className="list-title">{block.title}</p> : null}
                  <ul>
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              );
            }
            if (block.kind === 'callout') {
              return (
                <div className="encouragement" key={`${block.kind}-${index}`}>
                  {block.title ? <strong>{block.title}</strong> : null}
                  <p>{block.text}</p>
                </div>
              );
            }
            return null;
          })}

          <footer className="story-foot">
            <p className="byline">By {article.author}</p>
            <div className="story-actions">
              <Link className="cta" to="/blog" aria-label="Go back to all blog posts">
                Back to blog
              </Link>
            </div>
          </footer>
        </article>
      </main>

      <section className="more-reading card" aria-label="More blog posts">
        <div className="more-reading-head">
          <div>
            <p className="paper-eyebrow">Keep reading</p>
            <h3 className="more-title">More from the FitBuddy blog</h3>
          </div>
          <Link to="/blog" className="pill-link">
            View all
          </Link>
        </div>
        <div className="more-grid">
          {suggested.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className={`mini-card mini-vars-${post.slug.replace(/[^a-z0-9-_]/gi, '-')}`}
            >
              <div className="mini-top">
                <span className="mini-badge">{post.heroBadge || 'Story'}</span>
                <span className="mini-date">
                  {post.date} | {post.readTime}
                </span>
              </div>
              <h4>{post.title}</h4>
              <p>{post.dek}</p>
              <div className="mini-tags">
                {post.tags.slice(0, 2).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default BlogPage;
