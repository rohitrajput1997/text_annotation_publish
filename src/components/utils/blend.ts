import sortBy from "lodash.sortby";
import { blend, range } from "./utils";

const isNumber = (val: number | undefined): val is number => {
  return !!val;
};

const isRange = (val: any): val is number[] => {
  return !!val;
};

interface Split {
  start: number;
  end: number;
}

interface Tag extends Split {
  text?: string;
  tag?: string;
  color?: string;
  __index__?: number;
}

interface Blend extends Split {
  text?: string;
  tag: string;
  color: string;
}

interface Meta {
  color?: string;
  index?: number;
}

interface NonBlend {
  outRanges: number[][];
  metaData: Meta[];
}

export const focusOverlap = (baseTag: Tag, splits: Array<Tag>) => {
  const valA = baseTag;
  const overlap = splits
    .map((valB) => {
      if (valA.color) {
        if (
          valA.end >= valB.start &&
          valA.end <= valB.end &&
          valA.end - valB.start > 0 &&
          valB.color
        ) {
          return {
            start: valB.start,
            end: valA.end,
            color: blend(valA.color, valB.color),
          };
        } else if (
          valA.end >= valB.start &&
          valA.end >= valB.end &&
          valB.end - valB.start > 0 &&
          valB.color
        ) {
          return {
            start: valB.start,
            end: valB.end,
            color: blend(valA.color, valB.color),
            tag: valB.tag,
          };
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    })
    .filter((val): val is Blend => !!val);

  return overlap;
};

export const getOverlap = (splits: Array<Tag>) => {
  const localTags = [...splits];
  const splitLen = splits.length - 1;

  let result: Blend[] = [];
  let counter = 0;
  while (counter < splitLen) {
    const compTag = localTags.shift();
    compTag && result.push(...focusOverlap(compTag, [...localTags]));
    counter++;
  }

  return result;
};

const splitOneGap = (tagRange: Array<number>) => {
  const breaks: Array<number> = tagRange
    .map((i: number, j: number) => {
      if (i === -1) {
        return j;
      } else if (j === tagRange.length - 1) {
        return j;
      } else {
        return undefined;
      }
    })
    .filter(isNumber);

  let breakPoint = 0;

  return breaks
    .map((i: number, j: number) => {
      let group: Array<number>;

      if (j === breaks.length - 1) {
        group = tagRange.slice(breakPoint);
      } else {
        group = tagRange.slice(breakPoint, i);
        breakPoint = i + 1;
      }

      if (group.length > 1) {
        return group;
      } else {
        return undefined;
      }
    })
    .filter(isRange);
};

const splitGap = (tagRange: Array<number>) => {
  const finLen = tagRange.length - 1;

  const breaks: Array<number> = tagRange
    .map((i: number, j: number) => {
      if (i + 1 !== tagRange[j + 1] && j !== finLen) {
        return j + 1;
      } else if (j === finLen) {
        return j;
      } else {
        return undefined;
      }
    })
    .filter(isNumber);

  let breakPoint = 0;
  const outSet = breaks.map((i: number, j: number) => {
    if (j === breaks.length - 1) {
      return tagRange.slice(breakPoint);
    } else {
      const group = tagRange.slice(breakPoint, i);
      breakPoint = i;
      return group;
    }
  });
  return outSet.filter((set) => set.length > 1);
};

const updateIndices = (splits: Array<Tag>, blend: Array<Tag>) => {
  const metaData: Array<Meta> = [];
  const metaIndex: number[] = [];

  const blendRange = blend.flatMap((i) => range(i.start, i.end));

  let tagIndices: Array<number> = [];
  let totalIncInds: Array<number> = [];

  const tagRanges = splits
    .map((i, j) => {
      const tagRange = range(i.start, i.end);

      const semiInclusive: boolean =
        blendRange.includes(i.start) || blendRange.includes(i.end);

      const totalInclusive: boolean = tagRange.every((val: number) =>
        blendRange.includes(val)
      );

      const blendInclusive: boolean = blendRange.every((val: number) =>
        tagRange.includes(val)
      );
      if (semiInclusive || totalInclusive || blendInclusive) {
        tagIndices.push(j);
      }
      i.__index__ = j;

      if (
        (semiInclusive && !totalInclusive) ||
        (blendInclusive && !totalInclusive)
      ) {
        metaIndex.push(i.__index__);
        metaData.push({
          color: i.color,
        });
        return tagRange;
      } else if (semiInclusive && totalInclusive) {
        const inclusive = i;
        totalIncInds.push(
          splits.findIndex(
            (tag, index) =>
              tag.start <= inclusive.start && tag.end >= inclusive.end
          )
        );
        return undefined;
      } else {
        return undefined;
      }
    })
    .filter(isRange);

  const incRange: number[][] = [];
  const incMeta: Array<Meta> = [];
  totalIncInds = [...new Set(totalIncInds)];

  for (let val of totalIncInds) {
    if (metaIndex.every((meta) => meta !== val) && val >= 0) {
      let parentTag = range(splits[val].start, splits[val].end);

      blend.forEach((overlap) => {
        let start: number = 0;
        let end: number = 0;

        if (
          overlap.end - overlap.start === 1 &&
          parentTag.includes(overlap.end) &&
          parentTag.includes(overlap.start)
        ) {
          const splitIndex = parentTag.indexOf(overlap.start) + 1;
          parentTag.splice(splitIndex, 0, -1);
          return;
        }

        if (parentTag.includes(overlap.start)) {
          const index = parentTag.indexOf(overlap.start);
          if (index === 0) {
            start = overlap.start;
          } else {
            start = overlap.start + 1;
          }
        }

        if (parentTag.includes(overlap.end)) {
          const index = parentTag.indexOf(overlap.end);
          if (index === parentTag.length - 1) {
            end = overlap.end;
          } else {
            end = overlap.end - 1;
          }
        }

        [...parentTag] = parentTag.filter(
          (i) => !range(start, end).includes(i)
        );
      });
      incRange.push(parentTag);
      incMeta.push({
        color: splits[val].color,
      });
    }
  }

  const outRanges = tagRanges.map((val) => {
    let outRange = val;

    blend.forEach((overlap, _) => {
      let start: number, end: number;

      if (
        overlap.end - overlap.start === 1 &&
        outRange.includes(overlap.start)
      ) {
        const splitIndex = outRange.indexOf(overlap.start) + 1;
        outRange.splice(splitIndex, 0, -1);
        return;
      }

      if (outRange.includes(overlap.start)) {
        const index = outRange.indexOf(overlap.start);
        if (index === 0) {
          start = overlap.start;
        } else {
          start = overlap.start + 1;
        }
      }

      if (outRange.includes(overlap.end)) {
        const index = outRange.indexOf(overlap.end);
        if (index === outRange.length - 1) {
          end = overlap.end;
        } else {
          end = overlap.end - 1;
        }
      }

      outRange = outRange.filter((i) => !range(start, end).includes(i));
    });

    return outRange;
  });

  return {
    outRanges: [...outRanges, ...incRange],
    metaData: [...metaData, ...incMeta],
    tagIndices: [...tagIndices, ...totalIncInds],
  };
};

const tagFilter = (tags: NonBlend) => {
  const filterSet = tags.outRanges.flatMap((val, j) => {
    const tagMeta = tags.metaData[j];
    let tagVal: Array<number[]>;
    if (val.every((i, j) => i === val[0] + j)) {
      tagVal = [val];
    } else if (val.includes(-1)) {
      const tagValOne = splitOneGap(val);
      tagVal = tagValOne.flatMap((range) => splitGap(range));
    } else {
      tagVal = splitGap(val);
    }

    return tagVal.map((tag) => ({
      ...tagMeta,
      start: Math.min(...tag),
      end: Math.max(...tag),
    }));
  });
  return filterSet.filter((tag) => isFinite(tag.start) || isFinite(tag.end));
};

export const blender = (tags: Array<Tag>) => {
  const currentTags = sortBy(tags, ["start"]);

  let a1: Tag[] = [];
  currentTags.forEach((s) => {
    const index = a1.findIndex((a) => a.start === s.start && a.end === s.end);
    if (index !== -1) {
      a1[index].tag = `${a1[index].tag}`;
      a1[index].color = blend(a1[index].color || "", s.color || "");
      a1.push({
        ...s,
        start: a1[index].end,
        end: a1[index].end, 
      })
    } else {
      a1.push({ ...s });
    }
    
  });
  let arrDatta: Tag[] = [];
  a1.forEach((e) => {
    arrDatta = finalArrCreate(e, arrDatta);
  });
  const overlap = getOverlap(currentTags).filter(
    (d, index, self) =>
      index ===
      self.findIndex(
        (t) => t.end === d.end && t.start === d.start && t.tag === d.tag
      )
  );

  if (overlap.length) {
    const { tagIndices } = updateIndices(
      currentTags,
      overlap
    );

    // const outTags = tagFilter({ outRanges, metaData });

    // const remainder = currentTags.filter(
    //   (_, index) => !tagIndices.includes(index)
    // );

    tags.forEach((tag) => delete tag["__index__"]);

    return {
      tags: [...arrDatta],
      blendIndices: tagIndices,
    };
  } else return { tags: currentTags, blendIndices: [] };
};

const finalArrCreate = (currentTags: Tag, arr: Tag[]) => {
  if (arr.length === 0) {
    arr.push(currentTags);
    return arr;
  }
  let lastObject = currentTags;
  let finalArr: Tag[] = [];
  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    if (lastObject.start === arr[i].start && lastObject.end !== arr[i].end) {
      count = count + 1;
      finalArr.push({
        start: lastObject.start,
        end: lastObject.end > arr[i].end ? arr[i].end : lastObject.end,
        tag: lastObject.end > arr[i].end ? arr[i].tag : lastObject.tag,
        color: blend(lastObject.color || "", arr[i].color || ""),
      });
      const nextObject = arr[i + 1];
      if (nextObject && nextObject.start < lastObject.end) {
        if (nextObject.end > lastObject.end) {
          arr[i + 1].start = lastObject.end;
          finalArr.push({
            start: lastObject.end > arr[i].end ? arr[i].end : lastObject.end,
            end: lastObject.end < arr[i].end ? arr[i].end : lastObject.end,
            tag: lastObject.end < arr[i].end ? arr[i].tag : lastObject.tag,
            color: lastObject.color,
          });
        } else {
          finalArr.push({
            start: nextObject.end,
            end: lastObject.end,
            tag: lastObject.tag,
            color: lastObject.color,
          });
        }
      } else {
        finalArr.push({
          start: lastObject.end > arr[i].end ? arr[i].end : lastObject.end,
          end: lastObject.end < arr[i].end ? arr[i].end : lastObject.end,
          tag: lastObject.end < arr[i].end ? arr[i].tag : lastObject.tag,
          color: lastObject.end < arr[i].end ? arr[i].color : lastObject.color,
        });
      }
    } else if (
      lastObject.start > arr[i].start &&
      lastObject.end <= arr[i].end
    ) {
      count = count + 1;
      finalArr.push({
        start: arr[i].start,
        end: lastObject.start,
        tag: undefined,
        color: arr[i].color,
      });
      finalArr.push({
        start: lastObject.start,
        end: lastObject.end,
        tag:
          lastObject.end === arr[i].end
            ? `${arr[i].tag}`
            : lastObject.tag,
        color: blend(lastObject.color || "", arr[i].color || ""),
      });
      if(lastObject.end === arr[i].end) {
        finalArr.push({
          start: lastObject.end,
          end: lastObject.end,
          tag:`${lastObject.tag}`,
          color: lastObject.color || "",
        });
      }
      
      if (lastObject.end !== arr[i].end) {
        finalArr.push({
          start: lastObject.end,
          end: arr[i].end,
          tag: arr[i].tag,
          color: arr[i].color,
        });
      }
    } else if (
      lastObject.start > arr[i].start &&
      lastObject.start < arr[i].end &&
      lastObject.end > arr[i].end
    ) {
      count = count + 1;
      finalArr.push({
        start: arr[i].start,
        end: lastObject.start,
        tag: undefined,
        color: arr[i].color,
      });
      finalArr.push({
        start: lastObject.start,
        end: arr[i].end,
        tag: arr[i].tag,
        color: blend(lastObject.color || "", arr[i].color || ""),
      });
      finalArr.push({
        start: arr[i].end,
        end: lastObject.end,
        tag: lastObject.tag,
        color: blend(lastObject.color || "", arr[i].color || ""),
      });
      if (arr.length >= i + 1 && arr[i + 1]) {
        arr[i + 1].start = lastObject.end;
      }
    } else if (
      lastObject.start === arr[i].start &&
      lastObject.end === arr[i].end
    ) {
      count = count + 1;
      finalArr[i] = {
        start: arr[i].start,
        end: arr[i].end,
        tag: `${arr[i].tag}`,
        color: blend(lastObject.color || "", arr[i].color || ""),
      };
      finalArr.push({
        start: arr[i].end,
        end: arr[i].end,
        tag: `${lastObject.tag}`,
        color: lastObject.color,
      })

    } else {
      finalArr.push(arr[i]);
    }
  }
  if (count === 0) {
    finalArr.push(currentTags);
  }
  arr = finalArr;
  return finalArr;
};
