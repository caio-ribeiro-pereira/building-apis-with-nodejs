import Tasks from "./components/tasks.js";
import TaskForm from "./components/taskForm.js";
import User from "./components/user.js";
import Signin from "./components/signin.js";
import Signup from "./components/signup.js";
import Menu from "./components/menu.js";

class App {
  constructor(body, footer) {
    this.signin = new Signin(body);
    this.signup = new Signup(body);
    this.tasks = new Tasks(body);
    this.taskForm = new TaskForm(body);
    this.user = new User(body);
    this.menu = new Menu(footer);
  }
  init() {
    this.signin.render();
    this.addEventListener();
  }
  addEventListener() {
    this.signinEvents();
    this.signupEvents();
    this.tasksEvents();
    this.taskFormEvents();
    this.userEvents();
    this.menuEvents();
  }
  signinEvents() {
    this.signin.on("error", () => alert("Authentication error"));
    this.signin.on("signin", (token) => {
      localStorage.setItem("token", `JWT ${token}`);
      this.menu.render("tasks");
      this.tasks.render();
    });
    this.signin.on("signup", () => this.signup.render());
  }
  signupEvents(){
    this.signup.on("error", () => alert("Register error"));
    this.signup.on("signup", (user) => {
      alert(`${user.name} you were registered!`);
      this.signin.render();
    });
  }
  tasksEvents() {
    this.tasks.on("error", () => alert("Task list error"));
    this.tasks.on("remove-error", () => alert("Task delete error"));
    this.tasks.on("update-error", () => alert("Task update error"));
    this.tasks.on("remove", () => this.tasks.render());
    this.tasks.on("update", () => this.tasks.render());
  }
  taskFormEvents() {
    this.taskForm.on("error", () => alert("Task register error"));
    this.taskForm.on("submit", () => {
      this.menu.render("tasks");
      this.tasks.render();
    });
  }
  userEvents() {
    this.user.on("error", () => alert("User load error"));
    this.user.on("remove-error", () => alert("Cancel account error"));
    this.user.on("remove-account", () => {
      alert("So sad! You are leaving us :(");
      localStorage.clear();
      this.menu.clear();
      this.signin.render();
    });
  }
  menuEvents() {
    this.menu.on("click", (path) => {
      this.menu.render(path);
      this[path].render();
    });
    this.menu.on("logout", () => {
      localStorage.clear();
      this.menu.clear();
      this.signin.render();
    })
  }
}

module.exports = App;
