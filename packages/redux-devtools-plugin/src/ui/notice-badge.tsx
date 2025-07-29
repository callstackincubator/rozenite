import './notice-badge.css';

export type NoticeBadgeProps = {
  title: string;
  text: string;
  linkUrl?: string;
  linkText?: string;
};

export const NoticeBadge = ({
  title,
  text,
  linkUrl,
  linkText = 'Learn more',
}: NoticeBadgeProps) => {
  return (
    <div className="notice-badge">
      <svg
        className="notice-badge-icon"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
      <div className="notice-badge-content">
        <div className="notice-badge-title">{title}</div>
        <div className="notice-badge-text">{text}</div>
        {linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="notice-badge-link"
          >
            {linkText}
            <svg
              className="notice-badge-link-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
};
