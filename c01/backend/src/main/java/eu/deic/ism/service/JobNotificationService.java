package eu.deic.ism.service;

import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class JobNotificationService {

    private StringRedisTemplate redisTemplate;

    private RedisMessageListenerContainer redisListenerContainer;

    public JobNotificationService(StringRedisTemplate redisTemplate,
            RedisMessageListenerContainer redisListenerContainer) {
        this.redisTemplate = redisTemplate;
        this.redisListenerContainer = redisListenerContainer;
    }

    public void publish(String jobId, String downloadUrl) {
        redisTemplate.convertAndSend("job:" + jobId, downloadUrl);
    }

    public SseEmitter subscribe(String jobId) {
        SseEmitter emitter = new SseEmitter(300_000L);
        ChannelTopic topic = new ChannelTopic("job:" + jobId);

        MessageListener listener = (message, pattern) -> {
            try {
                String downloadUrl = new String(message.getBody());
                emitter.send(SseEmitter.event().name("done").data(downloadUrl));
                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        };

        redisListenerContainer.addMessageListener(listener, topic);

        emitter.onCompletion(() -> redisListenerContainer.removeMessageListener(listener, topic));
        emitter.onTimeout(() -> emitter.complete());

        return emitter;
    }
}
