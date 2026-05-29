package eu.deic.ism.messaging;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import eu.deic.ism.dto.JobDoneRequest;
import eu.deic.ism.service.JobService;

@Component
public class JobDoneListener {

    private final JobService jobService;

    public JobDoneListener(JobService jobService) {
        this.jobService = jobService;
    }

    @RabbitListener(queues = "job.done.queue", containerFactory = "jsonRabbitListenerContainerFactory")
    public void onJobDone(JobDoneRequest request) {
        jobService.handleJobDone(request);
    }
}
