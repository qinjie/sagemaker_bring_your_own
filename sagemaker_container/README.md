# SageMaker Bring Your Own Algorithm Container



SageMaker allows you to bring your own container. This project packages your own algorithm into a Docker image to be used in SageMaker. 

![image-20220121190645820](https://raw.githubusercontent.com/qinjie/picgo-images/main/image-20220121190645820.png)

This same container image supports both **training** and **scoring**.

- **training**: the algorithm uses input data to train a new model
- **serving**: the algorithm accepts HTTP requests and uses the previously trained model to do an inference

The container setup an inference server using `nginx`, `gunicorn`, and `flask`, where <u>nginx</u> provides reverse proxy, <u>gunicorn</u> is the load balancer, and <u>flask</u> for multiple web servers.

#### Important Folders in Container
Here are the 2 important folders in the container:
- `/opt/program`: Contains the code files in the `app/` folder.
- `/opt/ml`: Contains all input/output files, e.g. training data, generated model, and inference result files. It is commonly use S3 buckets to store these files. SageMaker will manage the file transfers between `/opt/ml` and s3 bucket(s). 

#### Prerequisite

- AWS CLI v1
- Docker
- Python 3.8+




## Project Structure

The container folder contains following files and folders.

- **Dockerfile**: Describes how the image is built and what it contains.
- **build_and_push.sh**: Builds the Docker image and push it to the [Amazon EC2 Container Registry (ECR)][ecr] so that it can be deployed to SageMaker.
- **app** folder: Contains code to be run in the container.
- **test** folder: Contains the scripts to run a simple training and inference jobs locally. Used for testing.
- **sagemaker_bring_your_own.ipynb**: Jupyter notebook file which can be setup in a SageMaker instance.



### Code Files - app Folder

This folder contains the main scripts for traning and scoring.

When SageMaker starts a container, it will invoke the container with an argument of either **train** or **serve**.

- **train**: It activates the code to train the model.
- **serve**, **wsgi.py**, **nginx.conf**: They setup a web server for inference. 

Following files may need to be updated for your own algorithm.

- **predictor.py**: It uses flask to setup 2 endpoints: `/ping` and `/invocations`. Update `/invocations` to read input data from `flask.request.data`, format them before calling your model to perform inference.
- **training/training.py**: Any training related code files are to be placed in `trainig` folder.
- **scoring/scoring.py**: Any scoring related code files are to be placed in `scoring` folder.
- **config/config.py**: Any common code files to be placed in `config` folder.



## Local Testing

We can perform tests in local machine before test it in SageMaker. The `test` folder contains scripts and dummy data for testing. 

The `test_dir` folder contains following subfolders:

- **input**: Input training data and configuration files
- **model**: Generated model files after training
- **output**: Result files from inference

We will mount `test_dir` folder to the `/opt/ml` folder in the container.



### Step by Step Debugging

1. Build the docker image with name (or tag) `sagemaker-bring-your-own`.
   * If the image is not updated, add `--no-cache` parameter to the `docker build` command.

```bash
docker build -t sagemaker-bring-your-own .
```

2. Run the container.
   - `--rm`: Remove the container when the command ends.
   - `-it`: Run it in interactive mode.
   - `--entrypoint`: Change the entrypoint to `/bin/bash` so that we can run command to debug our program.
   - `-v `: Map `test_dir` folder to `/opt/ml` folder in container. **Note:** The local path to `test_dir` must be an absolute path. (Docker requirement)
   - `-p 8080:8080`: Map the port 8080 which will be used for inference.

```bash
docker run --rm -it --entrypoint /bin/bash -v D:/github-data-govtech/sagemaker_bring_your_own/sagemaker_container/test/test_dir:/opt/ml -p 8080:8080 sagemaker-bring-your-own
```

3. You will be directed to bash and in the `/opt/program` folder when container runs.

4. Test the **<u>train mode</u>** by running the `train` script. 

```bash
python train
```

5. Test the **<u>serve mode</u>** by running the `serve` script. A web server will be running at port 8080.

```
python serve
```

6. Start another terminal session. Navigate into `container` folder in the project folder. Run following command to invoke the inference with a test file `test/data/payload.csv` 

```bash
curl --data-binary @test/data/payload.csv -H "Content-Type: text/csv" -v http://localhost:8080/invocation
```

7. Make sure there is no error from all above invocations.



### Run Container Directly

Once we confirm that the code works fine, we can run the bash test files directly. Note: these bash files are for Linux environment.  

- Train Model: Generated model will be saved in `test/test_dir/model` fodler
```
./train_local.sh sagemaker-bring-your-own
```
- Setup Server: Load model from `test/test_dir/model` and run a web server at port 8080
```
./serve_local.sh sagemaker-bring-your-own
```
- Invocation: Invoke server with test file `test/data/payload.csv`
```
./predict.sh test/data/payload.csv text/csv
```



## Testing in SageMaker

Refer to `sgsearch-content-classification.ipynb` for instructions. 



## Others

### Environment Variables

When you create an inference server, you can control some of Gunicorn's options via environment variables. These can be supplied as part of the CreateModel API call.

    Parameter                Environment Variable              Default Value
    ---------                --------------------              -------------
    number of workers        MODEL_SERVER_WORKERS              the number of CPU cores
    timeout                  MODEL_SERVER_TIMEOUT              60 seconds
