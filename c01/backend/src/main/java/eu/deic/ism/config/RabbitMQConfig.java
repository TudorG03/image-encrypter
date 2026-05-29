package eu.deic.ism.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.DefaultClassMapper;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.databind.ObjectMapper;

import eu.deic.ism.dto.JobDoneRequest;

@Configuration
public class RabbitMQConfig {

    @Bean
    ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    @Bean
    DirectExchange imageExchange() {
        return new DirectExchange("image.exchange", true, false);
    }

    @Bean
    Queue imageQueue() {
        return new Queue("image.queue", true);
    }

    @Bean
    Binding imageBinding(Queue imageQueue, DirectExchange imageExchange) {
        return BindingBuilder
                .bind(imageQueue)
                .to(imageExchange)
                .with("image.process");
    }

    @Bean
    TopicExchange jobEventsExchange() {
        return new TopicExchange("job.events.exchange", true, false);
    }

    @Bean
    Queue jobDoneQueue() {
        return new Queue("job.done.queue", true);
    }

    @Bean
    Binding jobDoneBinding(Queue jobDoneQueue, TopicExchange jobEventsExchange) {
        return BindingBuilder
                .bind(jobDoneQueue)
                .to(jobEventsExchange)
                .with("job.done");
    }

    // C03 publishes plain JSON without a __TypeId__ header, so map all
    // incoming bodies on the listener side to JobDoneRequest by default.
    @Bean
    Jackson2JsonMessageConverter jobDoneMessageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        DefaultClassMapper classMapper = new DefaultClassMapper();
        classMapper.setDefaultType(JobDoneRequest.class);
        converter.setClassMapper(classMapper);
        return converter;
    }

    @Bean
    SimpleRabbitListenerContainerFactory jsonRabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            Jackson2JsonMessageConverter jobDoneMessageConverter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jobDoneMessageConverter);
        return factory;
    }
}
