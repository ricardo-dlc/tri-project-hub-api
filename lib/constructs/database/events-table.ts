import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { StageConfiguration } from '../config/stage-config';

/**
 * Properties for EventsTable construct
 */
export interface EventsTableProps {
  /** Stage configuration for table naming */
  stageConfig: StageConfiguration;
  /** Custom table name (will be made stage-aware) */
  tableName?: string;
  /** Removal policy for the table */
  removalPolicy?: RemovalPolicy;
}

/**
 * EventsTable construct encapsulates all DynamoDB table configuration
 * including GSI definitions for the events table.
 *
 * This construct provides stage-aware table naming to enable multiple
 * deployments within the same AWS account.
 */
export class EventsTable extends Construct {
  public readonly table: Table;

  constructor(scope: Construct, id: string, props: EventsTableProps) {
    super(scope, id);

    const {
      stageConfig,
      tableName,
      removalPolicy = RemovalPolicy.DESTROY,
    } = props;

    // Generate stage-aware table name
    const finalTableName = tableName
      ? stageConfig.getTableName(tableName)
      : stageConfig.config.tableName;

    // Create the main events table
    this.table = new Table(this, 'Table', {
      tableName: finalTableName,
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });

    // Add all Global Secondary Indexes (GSIs) from the original implementation
    this.addGlobalSecondaryIndexes();
  }

  /**
   * Add all Global Secondary Indexes to the events table
   * These GSIs support various query patterns for the events API
   */
  private addGlobalSecondaryIndexes(): void {
    // SlugIndex - for querying events by slug
    this.table.addGlobalSecondaryIndex({
      indexName: 'SlugIndex',
      partitionKey: {
        name: 'slug',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    // TypeIndex - for querying events by type with date sorting
    this.table.addGlobalSecondaryIndex({
      indexName: 'TypeIndex',
      partitionKey: {
        name: 'typeEnabled',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    // FeaturedIndex - for querying featured events with date sorting
    this.table.addGlobalSecondaryIndex({
      indexName: 'FeaturedIndex',
      partitionKey: {
        name: 'isFeaturedEnabled',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    // DifficultyIndex - for querying events by difficulty with date sorting
    this.table.addGlobalSecondaryIndex({
      indexName: 'DifficultyIndex',
      partitionKey: {
        name: 'difficultyEnabled',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    // LocationIndex - for querying events by location with date sorting
    this.table.addGlobalSecondaryIndex({
      indexName: 'LocationIndex',
      partitionKey: {
        name: 'locationEnabled',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    // EnabledIndex - for querying enabled/disabled events with date sorting
    this.table.addGlobalSecondaryIndex({
      indexName: 'EnabledIndex',
      partitionKey: {
        name: 'enabledStatus',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });
  }

  /**
   * Grant read access to the events table for a Lambda function
   * @param lambda The Lambda function to grant read access to
   */
  grantReadAccess(lambda: IFunction): void {
    this.table.grantReadData(lambda);
  }

  /**
   * Grant write access to the events table for a Lambda function
   * @param lambda The Lambda function to grant write access to
   */
  grantWriteAccess(lambda: IFunction): void {
    this.table.grantWriteData(lambda);
  }

  /**
   * Grant full access (read and write) to the events table for a Lambda function
   * @param lambda The Lambda function to grant full access to
   */
  grantFullAccess(lambda: IFunction): void {
    this.table.grantFullAccess(lambda);
  }
}
