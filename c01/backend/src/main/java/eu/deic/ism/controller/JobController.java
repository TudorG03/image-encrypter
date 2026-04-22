package eu.deic.ism.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import eu.deic.ism.dto.JobResponse;
import eu.deic.ism.dto.JobSubmitResponse;
import eu.deic.ism.service.JobService;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    private JobService jobService;

    public JobController(JobService jobService) {
        this.jobService = jobService;
    }

    @PostMapping(value = "/submit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<JobSubmitResponse> submit(
            @RequestPart("file") MultipartFile file,
            @RequestParam String operation,
            @RequestParam String mode,
            @RequestParam String keyHex,
            @RequestParam(required = false) String ivHex) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        JobSubmitResponse response;

        try {
            response = jobService.submit(username, file.getBytes(), operation, mode, keyHex, ivHex);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<JobResponse>> list() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(jobService.listForUser(username));
    }
}
