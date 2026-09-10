let mobileBertModel = null;

async function loadMobileBert() {
  if (mobileBertModel) return mobileBertModel;

  if (typeof qna === "undefined") {
    throw new Error(
      "The QnA library did not load. Check your internet connection and CDN access."
    );
  }

  mobileBertModel = await qna.load();
  return mobileBertModel;
}

async function findAnswers(question, passage) {
  const model = await loadMobileBert();
  return model.findAnswers(question, passage);
}
