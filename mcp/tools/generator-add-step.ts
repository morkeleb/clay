/**
 * clay_generator_add_step tool - append a `generate` step to an existing
 * generator and write an engine-idiomatic template stub.
 */
import { createRequire } from 'node:module';
import { validateInput } from '../shared/validation.js';
import { GeneratorAddStepInputSchema } from '../shared/schemas.js';
import { getWorkspaceContext } from '../shared/workspace-manager.js';

const require = createRequire(import.meta.url);

export async function generatorAddStepTool(args: unknown) {
  const validation = validateInput(GeneratorAddStepInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }
  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const { addGeneratorStep } = require('clay-generator/generator-authoring');

    const result = addGeneratorStep({
      generatorName: input.generator_name,
      cwd: context.workingDirectory,
      engine: input.engine,
      template: input.template,
      select: input.select,
      target: input.target,
      touch: input.touch,
      content: input.content,
      overwrite: input.overwrite,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Added ${input.engine} step to generator "${input.generator_name}"`,
              generator_json: result.generatorJsonPath,
              template_file: result.templatePath,
              step: result.step,
              next_steps: [
                `Edit the template at ${result.templatePath}`,
                'Run clay_generate to produce output',
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (e) {
    return {
      content: [
        { type: 'text', text: JSON.stringify({ success: false, message: e instanceof Error ? e.message : String(e) }, null, 2) },
      ],
    };
  }
}
