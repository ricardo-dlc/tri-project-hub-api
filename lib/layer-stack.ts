import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StageConfiguration } from './constructs/config/stage-config';
import { SharedDependenciesLayer } from './constructs/layer/shared-dependencies-layer';
import { StackConfiguration } from './types/infrastructure';

export interface LayerStackProps extends StackProps {
  /** Stack configuration including stage and project settings */
  config?: StackConfiguration;
}

/**
 * Stack for Lambda layers deployed alongside the main API stack
 */
export class LayerStack extends Stack {
  public readonly sharedDependenciesLayer: SharedDependenciesLayer;

  constructor(scope: Construct, id: string, props?: LayerStackProps) {
    super(scope, id, props);

    const config = props?.config || {};

    // Create StageConfiguration
    const stageConfig = new StageConfiguration({
      stage: config.stage,
      projectName: config.projectName,
    });

    // Create shared dependencies layer
    this.sharedDependenciesLayer = new SharedDependenciesLayer(
      this,
      'SharedDependenciesLayer',
      {
        stageConfig,
      }
    );
  }
}
