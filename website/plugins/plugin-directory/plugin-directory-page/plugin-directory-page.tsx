import { usePageData } from 'rspress/runtime';
import { HomeFooter, OutlineCTA } from '@callstack/rspress-theme';

import { PluginCard } from '../plugin-card/plugin-card';
import { PluginDirectoryPage } from '../types';
import styles from './plugin-directory-page.module.css';

export const frontmatter = {
  pageType: 'custom',
  sidebar: true,
};

const generatePageNumbers = (
  currentPage: number,
  totalPages: number
): (number | string)[] => {
  const pages: (number | string)[] = [];
  const maxVisiblePages = 5;

  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    if (currentPage <= 3) {
      for (let i = 1; i <= 4; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 3; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    }
  }

  return pages;
};

const PaginationControls = ({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) => {
  const pageNumbers = generatePageNumbers(page, totalPages);

  return (
    <div className={styles.footer}>
      <div className={styles.pagination}>
        <a
          href={page > 1 ? `/plugin-directory/${page - 1}` : undefined}
          className={`${styles.paginationButton} ${
            page <= 1 ? styles.disabled : ''
          }`}
          style={{ pointerEvents: page <= 1 ? 'none' : 'auto' }}
        >
          ← Previous
        </a>

        <div className={styles.pageNumbers}>
          {pageNumbers.map((pageNum, index) => (
            <span key={index}>
              {pageNum === '...' ? (
                <span className={styles.paginationInfo}>...</span>
              ) : (
                <a
                  href={`/plugin-directory/${pageNum}`}
                  className={`${styles.pageNumber} ${
                    pageNum === page ? styles.active : ''
                  }`}
                >
                  {pageNum}
                </a>
              )}
            </span>
          ))}
        </div>

        <a
          href={page < totalPages ? `/plugin-directory/${page + 1}` : undefined}
          className={`${styles.paginationButton} ${
            page >= totalPages ? styles.disabled : ''
          }`}
          style={{ pointerEvents: page >= totalPages ? 'none' : 'auto' }}
        >
          Next →
        </a>
      </div>
    </div>
  );
};

export default function DirectoryPage() {
  const data = usePageData();

  if (!data.page.pluginDirectoryPage) {
    // 'data' may still hold previous page data in dev mode
    return null;
  }

  const page = data.page.pluginDirectoryPage as PluginDirectoryPage;

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <div className={styles.list}>
          {page.data.map((plugin, index) => (
            <PluginCard
              key={`${plugin.packageName}-${index}`}
              plugin={plugin}
            />
          ))}
        </div>

        <div className={styles.ctaContainer}>
          <OutlineCTA
            headline="Want to add your own plugin?"
            description="Open a pull request in our repository to contribute your plugin to this list."
            buttonText="View Repository"
            href="https://github.com/callstackincubator/rozenite"
          />
        </div>
      </div>

      <div className={styles.footerContainer}>
        <PaginationControls
          page={page.pageNumber}
          totalPages={page.totalPages}
        />
      </div>
      <HomeFooter />
    </div>
  );
}
