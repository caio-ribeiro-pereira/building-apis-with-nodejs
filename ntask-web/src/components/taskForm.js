import NTask from "../ntask.js";
import Template from "../templates/taskForm.js";

class TaskForm extends NTask {
  constructor(body) {
    super();
    this.body = body;
  }
  render() {
    this.body.innerHTML = Template.render();
    this.body.querySelector("[data-task]").focus();
    this.addEventListener();
  }
  addEventListener() {
    this.formSubmit();
  }
  formSubmit() {
    const form = this.body.querySelector("form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const task = e.target.querySelector("[data-task]");
      const opts = {
        method: "POST",
        url: `${this.URL}/tasks`,
        json: true,
        headers: {
          authorization: localStorage.getItem("token")
        },
        body: {
          title: task.value
        }
      };
      this.request(opts, (err, resp, data) => {
        if (err || resp.status === 412) {
          this.emit("error");
        } else {
          this.emit("submit");
        }
      });
    });
  }
}

module.exports = TaskForm;
