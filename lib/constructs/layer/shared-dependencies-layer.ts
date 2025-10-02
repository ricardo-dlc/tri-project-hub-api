import { Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { StageConfiguration } from '../config/stage-config';

export interface SharedDependenciesLayerProps {
  /** Stage configuration for naming and environment-specific settings */
  stageConfig: StageConfiguration;
  /** Optional custom layer name (defaults to 'shared-dependencies') */
  layerName?: string;
  /** Optional description for the layer */
  description?: string;
}

/**
 * SharedDependenciesLayer provides a Lambda layer with common dependencies
 * like ulid and dynamoose to reduce bundle sizes and improve cold start times.
 */
export class SharedDependenciesLayer extends Construct {
  public readonly layer: LayerVersion;

  constructor(scope: Construct, id: string, props: SharedDependenciesLayerProps) {
    super(scope, id);

    const layerName = props.stageConfig.getResourceName(
      props.layerName || 'shared-dependencies'
    );

    const description = props.description ||
      'Shared dependencies layer containing ulid and electrodb packages';

    this.layer = new LayerVersion(this, 'Layer', {
      layerVersionName: layerName,
      description,
      code: Code.fromAsset('lambda-layers/shared-dependencies', {
        bundling: {
          image: Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash',
            '-c',
            [
              'export HOME=/tmp',
              'mkdir -p /tmp/bin',
              'curl -fsSL https://github.com/pnpm/pnpm/releases/latest/download/pnpm-linuxstatic-x64 -o /tmp/bin/pnpm',
              'chmod +x /tmp/bin/pnpm',
              'export PATH="/tmp/bin:$PATH"',
              'mkdir -p /tmp/build',
              'cp package.json /tmp/build/',
              'cd /tmp/build',
              'pnpm install --prod --no-lockfile --shamefully-hoist',
              'mkdir -p /asset-output/nodejs',
              'cp -r /tmp/build/node_modules /asset-output/nodejs/',
            ].join(' && '),
          ],
        },
      }),
      compatibleRuntimes: [Runtime.NODEJS_22_X],
    });
  }
}
