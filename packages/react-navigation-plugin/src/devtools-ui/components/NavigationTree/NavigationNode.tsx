import React, { ReactNode } from 'react';

import { PartialState } from '@react-navigation/core';
import { NavigationState } from '../../../shared';
import { Leaf } from './Leaf';
import { generateColor } from './navigationTreeColors';

export const NavigationNode = ({
  name,
  state,
  parentColor,
  isParamsVisible,
}: {
  name: string;
  state: NavigationState | PartialState<NavigationState>;
  parentColor: string;
  isParamsVisible?: boolean;
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
                isParamsVisible={isParamsVisible}
              />
            ) : (
              <Leaf
                title={route.name}
                subtitle={
                  isParamsVisible &&
                  route.params &&
                  Object.keys(route.params).length > 0
                    ? `${JSON.stringify(route.params)}`
                    : undefined
                }
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
      <span className={`text-${color}-600 self-center`}>{name}</span>
    </NodeContainer>
  );
};

const ClosedNode = ({
  name,
  color,
  openNode,
}: {
  name: string;
  color: string;
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
      <span className={`text-${color}-600`}>{name}</span>
    </NodeContainer>
  );
};

export const NodeContainer = ({
  color,
  isClosed,
  children,
  onClick,
}: {
  color: string;
  isClosed?: boolean;
  children: ReactNode;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}) => {
  return (
    <div
      className={`items-stretch flex flex-col rounded-sm cursor-pointer bg-transparent border-2 border-solid p-1 text-center border-${color}-600 ${
        isClosed ? '' : 'border-t-0 rounded-t-none'
      } hover:bg-${color}-600 hover:bg-opacity-30`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

const TabContainer = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-1 flex-row items-center justify-around">
      {children}
    </div>
  );
};
