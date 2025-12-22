import { AlgorithmStep } from "@/components/visualizer/AlgorithmOverviewCanvas";

export const generateStringRotationSteps = (s1: string, s2: string): AlgorithmStep[] => {
    const steps: AlgorithmStep[] = [];
    let id = 0;

    // Step 1: Initial Check lengths
    steps.push({
        id: id++,
        highlightedLines: [0], // "if (s1.length !== s2.length) return false;"
        description: `Checking string lengths. S1 length: ${s1.length}, S2 length: ${s2.length}`,
        state: {
            s1: s1,
            s2: s2,
            concatenated: null,
            status: s1.length !== s2.length ? 'mismatch' : 'checking',
            currentIndices: [],
            matchFound: false
        }
    });

    if (s1.length !== s2.length) {
        steps.push({
            id: id++,
            highlightedLines: [1], // "return false"
            description: "Lengths are different. Therefore, S2 cannot be a rotation of S1.",
            state: {
                s1, s2, concatenated: null, status: 'error', currentIndices: [], matchFound: false
            }
        });
        return steps;
    }

    // Step 2: Concatenation
    const concatenated = s1 + s1;
    steps.push({
        id: id++,
        highlightedLines: [2], // "String concatenated = s1 + s1;"
        description: "Concatenate S1 with itself. If S2 is a rotation, it MUST be a substring of (S1 + S1).",
        state: {
            s1, s2, concatenated, status: 'concatenating', currentIndices: [], matchFound: false
        }
    });

    // Step 3: Searching
    // We will simulate the search of s2 within concatenated
    for (let i = 0; i <= concatenated.length - s2.length; i++) {
        const window = concatenated.substring(i, i + s2.length);

        // Highlight window
        steps.push({
            id: id++,
            highlightedLines: [3], // "if (concatenated.contains(s2))"
            description: `Checking window at index ${i}: "${window}". Does it match "${s2}"?`,
            state: {
                s1, s2, concatenated, status: 'searching', currentIndices: Array.from({ length: s2.length }, (_, k) => k + i), matchFound: false
            }
        });

        if (window === s2) {
            steps.push({
                id: id++,
                highlightedLines: [4], // "return true"
                description: `Match found! "${window}" equals "${s2}". S2 is a rotation of S1.`,
                state: {
                    s1, s2, concatenated, status: 'success', currentIndices: Array.from({ length: s2.length }, (_, k) => k + i), matchFound: true
                }
            });
            return steps;
        }
    }

    // If loop finishes without match
    steps.push({
        id: id++,
        highlightedLines: [5], // "return false"
        description: "No match found after checking all substrings. S2 is NOT a rotation of S1.",
        state: {
            s1, s2, concatenated, status: 'error', currentIndices: [], matchFound: false
        }
    });

    return steps;
};


export const STRING_ROTATION_PSEUDOCODE = `
function isRotation(s1, s2):
  if length(s1) != length(s2):
    return false
  
  concatenated = s1 + s1
  
  if concatenated.contains(s2):
    return true
    
  return false
`;
