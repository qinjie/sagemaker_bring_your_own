import cdk = require("@aws-cdk/core");
import iam = require("@aws-cdk/aws-iam");

export class PermissionsBoundary implements cdk.IAspect {
  private readonly permissionsBoundaryArn: string;

  constructor(permissionBoundaryArn: string) {
    this.permissionsBoundaryArn = permissionBoundaryArn;
  }

  public visit(node: cdk.IConstruct): void {
    if (
      cdk.CfnResource.isCfnResource(node) &&
      node.cfnResourceType === "AWS::IAM::Role"
    ) {
      node.addPropertyOverride(
        "PermissionsBoundary",
        this.permissionsBoundaryArn
      );
    }
  }
}
