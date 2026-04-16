package eu.deic.ism;

import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;

public class AppLifecycleListener implements ServletContextListener {

    private Thread consumerThread;
    private JobConsumer consumer;

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        consumer.stop();
        consumerThread.interrupt();
    }

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        consumer = new JobConsumer();
        consumerThread = new Thread(consumer);
        consumerThread.setDaemon(true);
        consumerThread.start();
    }
}
