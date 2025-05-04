# Indian Dish Nutrition Estimator

This project is a simple tool to estimate the nutritional values of Indian dishes, offering both a command-line interface (CLI) and a web API.

## Project Structure

The project consists of the following main files:

* `recipee.js`: Contains the web API using Express.js, handling requests to the `/estimate` route and likely containing the core logic for estimating nutrition.
* `recipe.js`: Contains the command-line interface (CLI) script to estimate nutrition directly from the terminal, potentially also containing or importing the core logic.
* `.env` (optional): Stores sensitive information like API keys and the Google Sheet ID as environment variables.
* `README.md`: This file, providing an overview and instructions for the project.

## Setup

Follow the setup instructions in the previous `README.md` content, ensuring you have Node.js, npm, Google Cloud Project with Gemini and Sheets APIs enabled, and your API keys and Google Sheet ID.

## Running the Application

You can run the nutrition estimator in two ways: as a web API or as a command-line tool.

### Running the Web API

1.  Ensure you have followed the setup and configuration steps.
2.  Run the API server using the following command in your terminal:
    ```bash
    node recipee.js
    ```
    You should see the message `Server listening at http://localhost:3000` (or the port you configured).

#### Using the API

1.  Open a tool like Postman, Insomnia, or `curl`.
2.  Make a **POST** request to the endpoint `http://localhost:3000/estimate`.
3.  In the **request body**, send a JSON object with the `dishName` you want to estimate nutrition for:
    ```json
    {
        "dishName": "paneer butter masala"
    }
    ```
4.  The API will respond with a JSON object containing the estimated nutrition information, the dish type, and the ingredients used.

### Running the Command-Line Interface (CLI)

1.  Ensure you have followed the setup and configuration steps.
2.  Navigate to the project directory in your terminal.
3.  Run the `recipe.js` script followed by the dish name in quotes:
    ```bash
    node recipe.js "aloo gobi"
    ```
    Replace `"aloo gobi"` with the name of the Indian dish you want to estimate.
4.  The script will output the estimated nutrition information in JSON format directly in your terminal.

## Explanation of the Flow

The core logic for estimation (data loading, recipe fetching, category identification, ingredient processing, and nutrition calculation) is likely contained within or imported by both `recipee.js` and `recipe.js`.

* **`recipee.js` (Web API):** This script sets up the Express.js server and defines the `/estimate` route. When a POST request is received at this route, it uses the core logic to estimate the nutrition for the provided `dishName` and returns the result as a JSON response.
* **`recipe.js` (CLI):** This script takes the dish name as a command-line argument, uses the core logic to perform the nutrition estimation, and then prints the result to the console.

## Handling of Edge Cases and Ambiguity

The handling of edge cases and ambiguity would be implemented within the core nutrition estimation logic present in or used by both `recipee.js` and `recipe.js`.

## Limitations and Future Improvements

The limitations and potential future improvements would apply to the shared core logic used by both the API and the CLI.

## Contributing

(Add any contribution guidelines if you plan to allow others to contribute to the project.)

---