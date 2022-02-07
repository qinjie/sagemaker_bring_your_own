import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as lambda from "@aws-cdk/aws-lambda";
import * as s3 from "@aws-cdk/aws-s3";
import * as path from "path";
import {
  CorsHttpMethod,
  DomainName,
  HttpApi,
  HttpMethod,
} from "@aws-cdk/aws-apigatewayv2";
import { LambdaProxyIntegration } from "@aws-cdk/aws-apigatewayv2-integrations";
import * as route53 from "@aws-cdk/aws-route53";
import * as route53_targets from "@aws-cdk/aws-route53-targets";
import * as cert_manager from "@aws-cdk/aws-certificatemanager";
import { EnvVariablesType, loadEnv } from "../cdk-common/stack-utils";

export interface LambdaStackProps extends cdk.StackProps {
  project_code: string;
  // vpc_id: string;
  // subnet_ids?: string[];
  // domain_name?: string;
  // hosted_zone_name?: string;
  // hosted_zone_id?: string;
  lambda_src_path: string;
  sagemaker_endpoint: string;
}

export class LambdaStack extends cdk.Stack {
  public lambdaCode: lambda.CfnParametersCode;
  project_code: string;
  lambdaFunction: lambda.IFunction;
  httpApi: HttpApi;
  aRecord: route53.ARecord;

  constructor(scope: cdk.Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);
    this.project_code = props.project_code;

    /* Load environment variables */
    let env_values = loadEnv(
      path.join(__dirname, "..", props?.lambda_src_path!, ".env")
    );
    env_values = {
      ...env_values,
      SAGEMAKER_ENDPOINT: props.sagemaker_endpoint,
    };

    /* Create Lambda Function */
    this.createLambdaFunction(props, env_values);

    /* Create API Gateway */
    this.httpApi = this.addApiGatewayToLambda(this, id, this.lambdaFunction);
    // this.httpApi = this.addCustomDomainApiGatewayToLambda(
    //   this,
    //   id,
    //   this.lambdaFunction,
    //   {
    //     ...props,
    //   }
    // );

    /* CloudFormation Output */
    this.output();
  }

  private output() {
    new cdk.CfnOutput(this, `ApiGatewayUrl-output`, {
      value: this.httpApi.url!,
      exportName: `${this.project_code}-ApiGatewayUrl`,
    });

    // new cdk.CfnOutput(this, `DomainName-output`, {
    //   value: this.aRecord.domainName,
    //   exportName: `${this.project_code}-DomainName`,
    // });
  }

  private createLambdaFunction(
    props: LambdaStackProps,
    env_values: EnvVariablesType
  ) {
    this.lambdaCode = lambda.Code.fromCfnParameters();

    // Role with DynamoDBFullAccess
    const lambdaARole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaVPCAccessExecutionRole"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonDynamoDBFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSESFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSNSFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSQSFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSLambda_FullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite"),
      ],
    });

    this.lambdaFunction = new lambda.Function(
      this,
      `${props.project_code}-lambda`,
      {
        code: this.lambdaCode,
        handler: "app.main.handler",
        runtime: lambda.Runtime.PYTHON_3_8,
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        environment: env_values,
        description: `Lambda function for ${props.project_code}`,
        functionName: `${props.project_code}-lambda`,
        role: lambdaARole,
      }
    );

    new cdk.CfnOutput(this, `LambdaFunctionName`, {
      value: this.lambdaFunction.functionName,
    });
  }

  private addApiGatewayToLambda(
    scope: cdk.Construct,
    id: string,
    lambdaFunction: lambda.IFunction
  ) {
    /* Create APIGateway */
    const httpApi = new HttpApi(scope, `${id}Api`, {
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [CorsHttpMethod.ANY],
        allowHeaders: ["*"],
      },
      apiName: `${id}Api`,
      defaultIntegration: new LambdaProxyIntegration({
        handler: lambdaFunction,
      }),
    });

    /* Integrate APIGateway with Lambda */
    const lambdaIntegration = new LambdaProxyIntegration({
      handler: lambdaFunction,
    });

    httpApi.addRoutes({
      integration: lambdaIntegration,
      path: "/{proxy+}",
      methods: [HttpMethod.ANY],
    });

    return httpApi;
  }

  private addCustomDomainApiGatewayToLambda(
    scope: cdk.Construct,
    id: string,
    lambdaFunction: lambda.IFunction,
    props: {
      hosted_zone_name?: string;
      hosted_zone_id?: string;
      domain_name?: string;
    }
  ) {
    const certificateArn =
      "arn:aws:acm:ap-southeast-1:305326993135:certificate/89b6971a-e7a8-411b-a818-1ed794f1de5c";
    const certificate = cert_manager.Certificate.fromCertificateArn(
      this,
      "certificateImported",
      certificateArn
    );

    const domain = new DomainName(this, "DomainName", {
      domainName: props.domain_name!,
      certificate: certificate,
    });

    /* Create APIGateway */
    const httpApi = new HttpApi(scope, `${id}Api`, {
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [CorsHttpMethod.ANY],
        allowHeaders: ["*"],
      },
      apiName: `${id}Api`,
      defaultIntegration: new LambdaProxyIntegration({
        handler: lambdaFunction,
      }),
      defaultDomainMapping: {
        domainName: domain,
      },
    });

    /* Integrate APIGateway with Lambda */
    const lambdaIntegration = new LambdaProxyIntegration({
      handler: lambdaFunction,
    });

    httpApi.addRoutes({
      integration: lambdaIntegration,
      path: "/{proxy+}",
      methods: [HttpMethod.ANY],
    });

    /* Add DNS to APIGateway */
    const zone = route53.PublicHostedZone.fromHostedZoneAttributes(
      scope,
      "hosted-zone",
      {
        zoneName: props.hosted_zone_name!,
        hostedZoneId: props.hosted_zone_id!,
      }
    );
    /* Route53 A Record                        */
    this.aRecord = new route53.ARecord(scope, "AliasRecrod", {
      zone,
      recordName: props.domain_name!,
      target: route53.RecordTarget.fromAlias(
        new route53_targets.ApiGatewayv2DomainProperties(
          domain.regionalDomainName,
          domain.regionalHostedZoneId
        )
      ),
    });
    this.aRecord.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    return httpApi;
  }
}
