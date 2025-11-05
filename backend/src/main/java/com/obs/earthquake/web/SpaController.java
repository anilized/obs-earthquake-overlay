package com.obs.earthquake.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

    @GetMapping({"/", "/overlay", "/settings", "/admin"})
    public String forwardIndex() {
        return "forward:/index.html";
    }
}
