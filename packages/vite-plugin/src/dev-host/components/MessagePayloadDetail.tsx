import { JSONTree } from 'react-json-tree';
import { jsonTreeTheme } from '../constants.js';
import { isJsonTreeData } from '../utils.js';

type MessagePayloadDetailProps = {
  payload: unknown;
};

export const MessagePayloadDetail = ({ payload }: MessagePayloadDetailProps) => {
  if (typeof payload === 'string') {
    return <pre className="rz-detail-pre rz-detail-mono">{payload}</pre>;
  }

  if (typeof payload === 'number' || typeof payload === 'boolean' || payload == null) {
    return <pre className="rz-detail-pre rz-detail-mono">{String(payload)}</pre>;
  }

  if (isJsonTreeData(payload)) {
    return (
      <div className="rz-detail-json-tree">
        <JSONTree
          data={payload}
          theme={jsonTreeTheme}
          invertTheme={false}
          shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
        />
      </div>
    );
  }

  return <pre className="rz-detail-pre rz-detail-mono">{String(payload)}</pre>;
};
