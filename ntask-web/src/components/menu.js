import NTask from "../ntask.js";
import Template from "../templates/footer.js";

class Menu extends NTask {
  constructor(body) {
    super();
    this.body = body;
  }
  render(path) {
    this.body.innerHTML = Template.render(path);
    this.addEventListener();
  }
  clear() {
    this.body.innerHTML = "";
  }
  addEventListener() {
    this.pathsClick();
    this.logoutClick();
  }
  pathsClick() {
    const links = this.body.querySelectorAll("[data-path]");
    for(let i = 0, max = links.length; i < max; i++) {
      links[i].addEventListener("click", (e) => {
        e.preventDefault();
        const link = e.target.parentElement;
        const path = link.getAttribute("data-path");
        this.emit("click", path);
      });
    }
  }
  logoutClick() {
    const link = this.body.querySelector("[data-logout]");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      this.emit("logout");
    })
  }
}

module.exports = Menu;
