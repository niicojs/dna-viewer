/**
 * Wraps seqviz's <SeqViz> component.
 *
 * SeqViz renders its own SVG viewers; we just need to:
 *  - Pass the right props (seq, name, annotations, viewer mode)
 *  - Give it a sized container
 *  - Disable external font downloads (we already load Geist)
 *  - Wire selection back to our selectedFeature state
 */

import { SeqViz } from 'seqviz';
import type { Selection } from 'seqviz/dist/selectionContext';
import type { XdnaFile } from '#/lib/xdna-parser';
import { xdnaToSeqViz } from '#/lib/xdna-to-seqviz';

type ViewerMode = 'circular' | 'linear' | 'both';

type Props = {
  xdna: XdnaFile;
  viewer?: ViewerMode;
  /** 0-based feature index from seqviz selection, or null */
  onSelection?: (selection: Selection) => void;
  /** Externally highlight a feature by its annotation name */
  highlightName?: string | null;
  search?: string;
};

export function SeqVizViewer({ xdna, viewer = 'circular', onSelection, search }: Props) {
  const { name, seq, annotations } = xdnaToSeqViz(xdna);

  // Build search prop only when non-empty
  const searchProp = search?.trim() ? { query: search.trim(), mismatch: 0 } : undefined;

  return (
    <div className="seqviz-wrap" style={{ width: '100%', height: '100%' }}>
      <SeqViz
        name={name}
        seq={seq}
        annotations={annotations}
        viewer={viewer === 'both' ? 'both' : viewer}
        // seqviz doesn't have a topology prop — circular is implied by viewer="circular"
        // For linear topology we still use circular viewer mode as seqviz always supports it
        showComplement={viewer !== 'circular'}
        showIndex
        rotateOnScroll={false}
        disableExternalFonts
        primers={[]}
        search={searchProp}
        onSelection={onSelection}
        style={{ height: '100%', width: '100%' }}
        zoom={{ linear: 50 }}
      />
    </div>
  );
}
