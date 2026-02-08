import { enableMetrics, createCustomLlmMetric, GalileoMetrics } from 'galileo';

async function setupScorers() {
  // 1. Create the custom empathy scorer (if it doesn't exist yet)
  try {
    await createCustomLlmMetric({
      name: 'empathy',
      userPrompt: `You are evaluating an immigration advisor AI's response for empathy.

Consider:
- Does the response acknowledge the client's emotional state and immigration-related stress?
- Does it use compassionate, non-judgmental language?
- Does it avoid being overly clinical or dismissive?
- Does it recognize the human impact of immigration decisions?

Input: {input}
Output: {output}

Rate the empathy of this response. Return TRUE if empathetic, FALSE otherwise.`,
      nodeLevel: 'llm',
      cotEnabled: true,
      modelName: 'gpt-4.1-mini',
      numJudges: 3,
      outputType: 'boolean',
      description: 'Evaluates empathy in immigration advisor responses',
      tags: ['saggiatore', 'immigration'],
    });
    console.log('Created custom empathy scorer');
  } catch (e) {
    console.log('Empathy scorer may already exist:', (e as Error).message);
  }

  // 2. Enable scorers on the log stream
  // Using non-luna variants available on this Galileo plan
  await enableMetrics({
    projectName: 'saggiatore',
    logStreamName: 'immigration-eval',
    metrics: [
      GalileoMetrics.toolSelectionQuality,
      GalileoMetrics.toolErrorRate,
      GalileoMetrics.completeness,
      GalileoMetrics.correctness,
      GalileoMetrics.outputToxicity,
      GalileoMetrics.outputPiiGpt,
      GalileoMetrics.promptInjection,
      'empathy',
    ],
  });

  console.log('All scorers enabled on immigration-eval log stream');
}

setupScorers().catch(console.error);
