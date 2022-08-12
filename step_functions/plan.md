# Plan



![image-20220331170749088](https://raw.githubusercontent.com/qinjie/picgo-images/main/image-20220331170749088.png)

## Scheduled Training

Model may need to be re-trained. When model is retrained, we will only use it if new model has higher accuracy than current model. 

Model training can be triggered by a lambda function

* Check if a input data exists in the s3 bucket.
* Execute the step function to retrain the model.
  * Step function will create model if new training job yield a better model.
  * Optionally step function can update an endpoint with the new model.

![image-20220331170933219](https://raw.githubusercontent.com/qinjie/picgo-images/main/image-20220331170933219.png)



## Which Trained Model to Use?

