import React from "react";
import { MarkedSpan } from "../types/annotate-types";
import { luminTest } from "./utils/utils";

export interface MarkProps<T> {
  key: string;
  content: string;
  start: number;
  end: number;
  onClick: (arg: T) => void;
  tag?: string;
  color?: string;
  className?: string;
  index?: number;
}

const Mark = <T extends MarkedSpan>({
  color,
  className,
  end,
  start,
  onClick,
  content,
  tag,
}: MarkProps<T>) => {
  const lumin = color ? luminTest(color) : false;
  return (
    <mark
      className={className}
      style={{
        backgroundColor: color || "#84d2ff",
        padding: "0 4px",
        ...(lumin && { color: "white" }),
      }}
      data-start={start}
      data-end={end}
      onMouseUp={() => onClick({ start: start, end: end } as T)}
    >
      {content}
      {tag && (
        <span style={{ fontWeight: 'bold', marginLeft: 6, fontSize: '10px',
          background: 'white',
          color: 'black',
          padding: '1px 4px',
          borderRadius: '10px' }}>
          {String(tag)}
        </span>
      )}
    </mark>
  );
};

export default Mark;
