// Regression examples for the Version 4.1 signatory fix.
// Expected normalized relationships:
//
// DR. JAMES A. ESQUIVEL is the instructor.
// MS. MELISSA M. PANTIG is the chair.
// DR. LILIBETH T. CUISON is the dean.
//
// The syllabus was prepared by DR. JAMES A. ESQUIVEL.
// The syllabus was reviewed by MS. MELISSA M. PANTIG.
// The syllabus was approved by DR. LILIBETH T. CUISON.

const flattenedExample = `
Prepared by Reviewed by Approved by
DR. JAMES A. ESQUIVEL
MS. MELISSA M. PANTIG
DR. LILIBETH T. CUISON
Instructor
Chair
Dean
`;
