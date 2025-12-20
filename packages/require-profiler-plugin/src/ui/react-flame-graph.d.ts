declare module 'react-flame-graph' {
  import { MouseEvent } from 'react';

  export type NodeUid = string | number;

  export type RawData = {
    backgroundColor?: string;
    color?: string;
    children?: RawData[];
    id?: string;
    name: string;
    tooltip?: string;
    uid?: NodeUid;
    value: number;
  };

  export type ChartNode = {
    backgroundColor: string;
    color: string;
    depth: number;
    left: number;
    name: string;
    source: RawData;
    tooltip?: string;
    width: number;
  };

  export type ChartData = {
    height: number;
    levels: NodeUid[][];
    nodes: Record<NodeUid, ChartNode>;
    root: NodeUid;
  };

  export type ItemData = {
    data: ChartData;
    disableDefaultTooltips: boolean;
    focusedNode: ChartNode;
    focusNode: (chartNode: ChartNode, uid: NodeUid) => void;
    handleMouseEnter: (event: MouseEvent, node: RawData) => void;
    handleMouseLeave: (event: MouseEvent, node: RawData) => void;
    handleMouseMove: (event: MouseEvent, node: RawData) => void;
    scale: (value: number) => number;
  };

  type Props = {
    data: RawData;
    height: number;
    width: number;
    onChange?: (chartNode: ChartNode, uid: NodeUid) => void;
  };

  export function FlameGraph(props: Props): React.ReactElement;
}
