Now let's implement the feature of rating system. Please propose system for restaurant and dish ratings. We should work together to come up with an optimal solution. We should use First Principle thinking, start with customers, what they want and propose a solution easy to use for customers (to review/rate the restaurant) and readable for them. - The system should be very easy for the user to add opinion about the dish and/or the restaurant - The restaurant rating might be dependent on the dish ratings and then additional information that customers provide, it doesn't have to be a separate rating - I'd rather avoid having a typical 5 star rating system and ask customers whether they like the dish or not, without explicitly adding a written comment - this will be easier for customer to provide feedback and encourange more users to provide their opinion

        Tenets that we should use while designing the user experience:
        * The system should be easy for users
        * The system should encourage users to provide feedback of dishes
        * We value dish rating over restaurant rating
        * We ask customer specific questions (i.e. "Were you satisfied with the cleaniness of the restaurant", "Were you satisfied with the service", "Were you satisfied with the food wait time", "Were you satisfied...") over having an open-end questions
        * We don't want to overwhelm the customer with too many questions. We want to collect an extensive data about the restaurant and dishes, but in the sam
        e time, we should ask every customer whether they like the food and some, but not all restaurant-related queetions
        *

We've been building the project without paying too much attention to design at the beginning and figuring out things on the way. This is fine, but now we have to make it production ready, organize the repository, structure it better, clean it up (there's still some mock data, unused pieces of code, etc.), follow development practices even better.
My idea is to first, cleaning up the code in the current repository, then based on the exisitng code creating user stories (and workflows based on them and the current flow), then re-writing code in the new repository.
