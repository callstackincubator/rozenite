export const Leaf = ({
  title,
  isSelectedTab,
  color,
  subtitle,
}: {
  title: string;
  isSelectedTab?: boolean;
  color: string;
  subtitle?: string;
}) => {
  return (
    <div
      className={`rounded-sm ${
        isSelectedTab
          ? `p-1 border-2 border-dashed border-${color}-600`
          : 'px-1'
      }`}
    >
      <button
        className={`p-2 text-center rounded-sm bg-${color}-600`}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <span className={`text-gray-100 ${isSelectedTab ? 'underline' : ''}`}>
          {title}
        </span>
        {subtitle ? <span className="text-gray-100">{subtitle}</span> : null}
      </button>
    </div>
  );
};
