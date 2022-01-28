import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as autoscaling from "@aws-cdk/aws-applicationautoscaling";
import {
  PredefinedMetric,
  ServiceNamespace,
} from "@aws-cdk/aws-applicationautoscaling";

export function getExistingTable(
  scope: cdk.Construct,
  tableName: string
): dynamodb.Table | undefined {
  let table: dynamodb.Table | undefined = undefined;
  try {
    // Formulate tableARN
    const tableArn = `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${tableName}`;
    // Get existing table
    table = dynamodb.Table.fromTableAttributes(
      scope,
      `getExistingTable_${tableName}`,
      {
        tableArn,
      }
    ) as dynamodb.Table;
  } catch (err) {
    table = undefined;
    console.log(`Not existing table ${tableName}`, err);
  }
  return table;
}

export function getExistingTableWithStream(
  scope: cdk.Construct,
  tableName: string,
  tableStreamArn: string
): dynamodb.Table | undefined {
  let table: dynamodb.Table | undefined = undefined;
  try {
    // Formulate tableARN
    const tableArn = `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${tableName}`;
    // Get existing table
    table = dynamodb.Table.fromTableAttributes(
      scope,
      `getExistingTable_${tableName}`,
      {
        tableArn,
        tableStreamArn: tableStreamArn,
      }
    ) as dynamodb.Table;
  } catch (err) {
    table = undefined;
    console.log(
      `Not existing table ${tableName} or stream ${tableStreamArn}`,
      err
    );
  }
  return table;
}

/*
Set autoscale for a dynamodb table or index.
resourceName: table/${resourceName} or index/${indexName}
*/
export function setAutoscaleDynamoTable(
  scope: cdk.Construct,
  resourceName: string,
  readMin: number = 1,
  readMax: number = 20,
  readThresh: number = 75,
  writeMin: number = 1,
  writeMax: number = 20,
  writeThresh: number = 75
) {
  const readAutoScaling = new autoscaling.ScalableTarget(
    scope,
    `target-read-${resourceName.replace("/", "-")}`,
    {
      serviceNamespace: ServiceNamespace.DYNAMODB,
      minCapacity: readMin,
      maxCapacity: readMax,
      resourceId: `${resourceName}`,
      scalableDimension: "dynamodb:table:ReadCapacityUnits",
    }
  );

  readAutoScaling.scaleToTrackMetric(
    `metric-read-${resourceName.replace("/", "-")}`,
    {
      targetValue: readThresh,
      predefinedMetric: PredefinedMetric.DYNAMODB_READ_CAPACITY_UTILIZATION,
    }
  );

  const writeAutoScaling = new autoscaling.ScalableTarget(
    scope,
    `target-write-${resourceName}.replace('/','-')`,
    {
      serviceNamespace: ServiceNamespace.DYNAMODB,
      minCapacity: writeMin,
      maxCapacity: writeMax,
      resourceId: `${resourceName}`,
      scalableDimension: "dynamodb:table:WriteCapacityUnits",
    }
  );

  writeAutoScaling.scaleToTrackMetric(
    `metric-write-${resourceName}.replace('/','-')`,
    {
      targetValue: writeThresh,
      predefinedMetric: PredefinedMetric.DYANMODB_WRITE_CAPACITY_UTILIZATION,
    }
  );
}
