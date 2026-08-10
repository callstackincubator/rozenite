import { usePageData } from '@rspress/core/runtime';
import { ArrowLeft, ArrowRight, ArrowUpRight } from '@phosphor-icons/react';

import '../../../landing/styles/tokens.css';
import { PluginCard } from '../plugin-card/plugin-card';
import { PluginDirectoryPage } from '../types';
import styles from './plugin-directory-page.module.css';

export const frontmatter = {
  pageType: 'custom',
  sidebar: true,
};

const generatePageNumbers = (currentPage: number, totalPages: number): (number | string)[] => {
  const pages: (number | string)[] = [];
  const maxVisiblePages = 5;

  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (currentPage <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i);
    pages.push('...', totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1, '...');
    for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1, '...');
    for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
    pages.push('...', totalPages);
  }

  return pages;
};

const PaginationControls = ({ page, totalPages }: { page: number; totalPages: number }) => {
  const pageNumbers = generatePageNumbers(page, totalPages);

  return (
    <nav className={styles.footer} aria-label="Plugin directory pages">
      <div className={styles.pagination}>
        <a
          href={page > 1 ? `/plugin-directory/${page - 1}` : undefined}
          className={`${styles.paginationButton} ${page <= 1 ? styles.disabled : ''}`}
          aria-disabled={page <= 1}
        >
          <ArrowLeft aria-hidden="true" size={16} weight="bold" />
          Previous
        </a>

        <div className={styles.pageNumbers}>
          {pageNumbers.map((pageNum, index) =>
            pageNum === '...' ? (
              <span key={`${pageNum}-${index}`} className={styles.paginationInfo}>
                ...
              </span>
            ) : (
              <a
                key={pageNum}
                href={`/plugin-directory/${pageNum}`}
                className={`${styles.pageNumber} ${pageNum === page ? styles.active : ''}`}
                aria-current={pageNum === page ? 'page' : undefined}
              >
                {pageNum}
              </a>
            ),
          )}
        </div>

        <a
          href={page < totalPages ? `/plugin-directory/${page + 1}` : undefined}
          className={`${styles.paginationButton} ${page >= totalPages ? styles.disabled : ''}`}
          aria-disabled={page >= totalPages}
        >
          Next
          <ArrowRight aria-hidden="true" size={16} weight="bold" />
        </a>
      </div>
    </nav>
  );
};

export default function DirectoryPage() {
  const data = usePageData();

  if (!data.page.pluginDirectoryPage) {
    // Data may still belong to the previous route during client-side dev reloads.
    return null;
  }

  const page = data.page.pluginDirectoryPage as PluginDirectoryPage;
  const pluginCount = page.data.length;

  return (
    <div className={styles.root} data-rz-landing>
      <main>
        <section className={styles.hero}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>Plugin directory</p>
            <h1 className={styles.title}>Tools for the panels you need.</h1>
            <p className={styles.intro}>
              Extend React Native DevTools with ready-made plugins for the state, storage, and
              diagnostics your app depends on.
            </p>
          </div>
        </section>

        <section className={styles.directory} aria-labelledby="directory-title">
          <div className={styles.container}>
            <div className={styles.directoryHeader}>
              <h2 id="directory-title" className={styles.directoryTitle}>
                Explore plugins
              </h2>
              <p className={styles.count}>
                {pluginCount} plugin{pluginCount === 1 ? '' : 's'} on this page
              </p>
            </div>

            <div className={styles.grid}>
              {page.data.map((plugin, index) => (
                <PluginCard key={`${plugin.packageName}-${index}`} plugin={plugin} />
              ))}
            </div>

            <aside className={styles.contribute} aria-labelledby="contribute-title">
              <div>
                <h2 id="contribute-title" className={styles.contributeTitle}>
                  Built something useful?
                </h2>
                <p className={styles.contributeBody}>
                  Add your Rozenite plugin to the directory with a pull request.
                </p>
              </div>
              <a
                className={styles.contributeLink}
                href="https://github.com/callstackincubator/rozenite"
                target="_blank"
                rel="noreferrer noopener"
              >
                View repository
                <ArrowUpRight aria-hidden="true" size={17} weight="bold" />
              </a>
            </aside>
          </div>
        </section>
      </main>

      <footer className={styles.footerContainer}>
        <div className={styles.container}>
          <PaginationControls page={page.pageNumber} totalPages={page.totalPages} />
        </div>
      </footer>
    </div>
  );
}
