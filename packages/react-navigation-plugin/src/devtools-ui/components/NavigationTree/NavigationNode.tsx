import React, { type CSSProperties, type ReactNode } from 'react';
import type { PartialState } from '@react-navigation/core';
import type { NavigationState } from '../../../shared';
import { Leaf } from './Leaf';
import { generateColor, type NavigationTreeColor } from './navigationTreeColors';

export const NavigationNode = ({
  name,
  state,
  parentColor,
}: {
  name: string;
  state: NavigationState | PartialState<NavigationState>;
  parentColor: NavigationTreeColor;
}) => {
  const [isClosed, setIsClosed] = React.useState(false);

  const routes = state.routes;
  if (!routes || !routes.length) {
    return <Leaf title={name} color={parentColor} />;
  }

  const color = generateColor(state.key ?? '');

  const StackWrapper = state.type === 'tab' ? TabContainer : React.Fragment;

  if (isClosed) {
    return (
      <ClosedNode
        name={name}
        color={color}
        openNode={() => setIsClosed(false)}
      />
    );
  }

  return (
    <NodeContainer
      color={color}
      onClick={(e) => {
        setIsClosed(true);
        e.stopPropagation();
      }}
    >
      <StackWrapper>
        {[...routes].reverse().map((route, index) => (
          <React.Fragment key={route.key}>
            {route.state?.routes && route.state.routes.length ? (
              <NavigationNode
                name={route.name}
                state={route.state}
                parentColor={color}
              />
            ) : (
              <Leaf
                title={route.name}
                isSelectedTab={
                  state.type === 'tab' &&
                  state.index === state.routes.length - 1 - index
                }
                color={color}
              />
            )}
            {index < routes.length - 1 ? <div className="h-4" /> : null}
          </React.Fragment>
        ))}
      </StackWrapper>
      <span
        className="self-center px-2 pt-2 text-xs font-semibold uppercase tracking-[0.12em]"
        style={{ color: color.accent }}
      >
        {name}
      </span>
    </NodeContainer>
  );
};

const ClosedNode = ({
  name,
  color,
  openNode,
}: {
  name: string;
  color: NavigationTreeColor;
  openNode: () => void;
}) => {
  return (
    <NodeContainer
      color={color}
      onClick={(e) => {
        openNode();
        e.stopPropagation();
      }}
      isClosed
    >
      <span
        className="px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]"
        style={{ color: color.accent }}
      >
        {name}
      </span>
    </NodeContainer>
  );
};

export const NodeContainer = ({
  color,
  isClosed,
  children,
  onClick,
}: {
  color: NavigationTreeColor;
  isClosed?: boolean;
  children: ReactNode;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsHovered(true);
    e.stopPropagation();
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsHovered(false);
    e.stopPropagation();
  };

  const style: CSSProperties = {
    backgroundColor: isHovered ? color.soft : 'transparent',
    borderColor: color.accent,
    boxShadow: isHovered ? `0 0 0 1px ${color.softBorder}` : undefined,
  };

  return (
    <button
      className={`flex cursor-pointer flex-col items-stretch rounded-md border-2 p-1 text-center transition-colors ${
        isClosed ? '' : 'border-t-0 rounded-t-none'
      }`}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onClick={onClick}
      style={style}
      type="button"
    >
      {children}
    </button>
  );
};

const TabContainer = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-1 flex-row items-center justify-around gap-2">
      {children}
    </div>
  );
};
